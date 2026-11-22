import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnuitySchedule } from '../../utils/finance/annuity';
import { buildDueDates } from '../../utils/finance/date';
import { round2 } from '../../utils/finance/round';
import { paymentsService } from './payments.service';

/**
 * Предпросмотр и применение досрочного платежа обязаны показывать и записывать
 * ОДИНАКОВЫЕ деньги. Все данные синтетические, prisma и push подменены.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    credit: { update: vi.fn(), updateMany: vi.fn() },
    paymentSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    paymentEvent: { create: vi.fn(), findFirst: vi.fn() },
  };
  return {
    tx,
    findFirst: vi.fn(),
    transaction: vi.fn(),
    sendPush: vi.fn(),
  };
});

vi.mock('../../config/prisma', () => ({
  prisma: {
    credit: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../push/push.service', () => ({ sendUniquePush: mocks.sendPush }));

const USER_ID = 'parity-user';
const CREDIT_ID = 'parity-credit';
const PRINCIPAL = 1_000_000;
const ANNUAL = 20;
const TERM = 60;
const START = new Date(Date.UTC(2024, 0, 1));

interface Row {
  id: string;
  creditId: string;
  dueDate: Date;
  amount: number;
  principalPart: number;
  interestPart: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  paidAt: Date | null;
  paidAmount: number | null;
}

interface Credit {
  id: string;
  userId: string;
  name: string;
  status: string;
  type: string;
  termMonths: number;
  startDate: Date;
  outstanding: number;
  annualRate: number;
  paymentType: string;
  paymentDay: number;
  principal: number;
  prepaymentMode: string;
  schedule: Row[];
  events: unknown[];
}

function row(index: number, item: { dueDate: Date; amount: number; principalPart: number; interestPart: number }, paid: boolean): Row {
  return {
    id: `row-${index}`,
    creditId: CREDIT_ID,
    dueDate: item.dueDate,
    amount: item.amount,
    principalPart: item.principalPart,
    interestPart: item.interestPart,
    status: paid ? 'PAID' : 'PENDING',
    paidAt: paid ? item.dueDate : null,
    paidAmount: paid ? item.amount : null,
  };
}

function longCredit(): Credit {
  const base = buildAnnuitySchedule(PRINCIPAL, ANNUAL, TERM, buildDueDates(START, TERM, 1));
  const schedule = base.map((item, i) => row(i, item, i < 26));
  const outstanding = round2(schedule.filter((s) => s.status === 'PENDING').reduce((sum, s) => sum + s.principalPart, 0));
  return {
    id: CREDIT_ID,
    userId: USER_ID,
    name: 'Эталонный кредит',
    status: 'ACTIVE',
    type: 'CONSUMER',
    termMonths: TERM,
    startDate: START,
    outstanding,
    annualRate: ANNUAL,
    paymentType: 'ANNUITY',
    paymentDay: 1,
    principal: PRINCIPAL,
    prepaymentMode: 'REDUCE_TERM',
    schedule,
    events: [],
  };
}

function shortCredit(): Credit {
  const base = buildAnnuitySchedule(100_000, 12, 12, buildDueDates(new Date(Date.UTC(2026, 0, 1)), 12, 15));
  const schedule = base.map((item, i) => row(i, item, i < 1));
  return {
    ...longCredit(),
    principal: 100_000,
    annualRate: 12,
    termMonths: 12,
    paymentDay: 15,
    outstanding: 80_000,
    schedule,
  };
}

function appliedSchedule(): Array<{ dueDate: Date; amount: number; principalPart: number; interestPart: number }> {
  const call = mocks.tx.paymentSchedule.createMany.mock.calls.at(-1);
  if (!call) return [];
  return ((call[0] as any).data ?? []) as Array<{ dueDate: Date; amount: number; principalPart: number; interestPart: number }>;
}

function appliedOutstanding(): number | undefined {
  const call = mocks.tx.credit.update.mock.calls.at(-1);
  return (call?.[0] as any)?.data?.outstanding as number | undefined;
}

function pay(date: string, amount: number) {
  return paymentsService.earlyRepayment(USER_ID, CREDIT_ID, {
    amount,
    date: new Date(date),
    mode: 'REDUCE_TERM',
  });
}

function preview(date: string, amount: number) {
  return paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, {
    amount,
    date: new Date(date),
    mode: 'REDUCE_TERM',
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 2, 15)));
  vi.resetAllMocks();

  mocks.findFirst.mockResolvedValue(longCredit());
  mocks.transaction.mockImplementation(async (cb: any) => cb(mocks.tx));
  mocks.tx.paymentSchedule.findUnique.mockResolvedValue(null);
  mocks.tx.paymentSchedule.update.mockResolvedValue({});
  mocks.tx.paymentSchedule.create.mockResolvedValue({});
  mocks.tx.paymentSchedule.upsert.mockResolvedValue({});
  mocks.tx.paymentSchedule.createMany.mockResolvedValue({ count: 0 });
  mocks.tx.paymentSchedule.deleteMany.mockResolvedValue({ count: 0 });
  mocks.tx.paymentEvent.create.mockResolvedValue({ id: 'evt' });
  mocks.tx.paymentEvent.findFirst.mockResolvedValue(null);
  mocks.tx.credit.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.credit.update.mockImplementation(async ({ data }: any) => ({ ...longCredit(), ...data }));
  mocks.sendPush.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('предпросмотр = применение', () => {
  it('повторная досрочка: предсказанные платеж, срок и проценты совпадают с записанными', async () => {
    await pay('2026-03-15T00:00:00.000Z', 200_000);
    const firstItems = appliedSchedule();
    const firstOutstanding = appliedOutstanding();
    expect(firstItems.length).toBeGreaterThan(0);
    expect(firstOutstanding).toBeGreaterThan(0);

    const afterFirst: Credit = {
      ...longCredit(),
      outstanding: firstOutstanding!,
      schedule: [
        ...longCredit().schedule.filter((s) => s.status === 'PAID'),
        {
          id: 'early-1',
          creditId: CREDIT_ID,
          dueDate: new Date('2026-03-15T00:00:00.000Z'),
          amount: 200_000,
          principalPart: 198_000,
          interestPart: 2_000,
          status: 'PAID',
          paidAt: new Date('2026-03-15T00:00:00.000Z'),
          paidAmount: 200_000,
        },
        ...firstItems.map((item, i) => row(100 + i, item, false)),
      ],
    };
    mocks.findFirst.mockResolvedValue(afterFirst);

    const forecast = await preview('2026-07-15T00:00:00.000Z', 100_000);
    await pay('2026-07-15T00:00:00.000Z', 100_000);
    const written = appliedSchedule();

    expect(forecast.coversInterest).toBe(true);
    expect(written.length).toBeGreaterThan(0);
    expect(forecast.monthsAfter, 'предсказанное число платежей').toBe(written.length);
    expect(forecast.paymentAfter, 'предсказанный платёж').toBeCloseTo(written[0].amount, 2);
    expect(forecast.interestAfter, 'предсказанные проценты').toBeCloseTo(
      round2(written.reduce((sum, item) => sum + item.interestPart, 0)),
      2,
    );
    expect(forecast.totalAfter, 'предсказанная сумма выплат').toBeCloseTo(
      round2(written.reduce((sum, item) => sum + item.amount, 0)),
      2,
    );
  });

  it('дата досрочки, совпадающая с датой платежа по графику, не удваивает сумму в строке', async () => {
    const credit = shortCredit();
    mocks.findFirst.mockResolvedValue(credit);
    const prepayment = 10_000;
    const date = '2026-03-15T00:00:00.000Z';
    const existing = credit.schedule.find((item) => item.dueDate.toISOString() === date);
    expect(existing, 'в графике должна быть строка с датой досрочки').toBeDefined();
    expect(existing!.status).toBe('PENDING');
    mocks.tx.paymentSchedule.findUnique.mockResolvedValue(existing);

    // Prisma upsert: обновлённая строка получает абсолютную сумму, а не increment.
    mocks.tx.paymentSchedule.upsert.mockImplementation(async ({ update, create }: any) => ({
      id: existing!.id,
      paidAmount: update ? update.paidAmount : create.paidAmount,
      amount: update ? update.amount : create.amount,
    }));

    await pay(date, prepayment);
    const upsertArg = mocks.tx.paymentSchedule.upsert.mock.calls[0]?.[0] as any;
    expect(upsertArg.update.paidAmount).toBe(prepayment);
    expect(upsertArg.update.amount).toBe(prepayment);
    expect(upsertArg.update.paidAmount?.increment).toBeUndefined();

    const written = await (mocks.tx.paymentSchedule.upsert.mock.results[0]?.value as Promise<any>);
    expect(written.paidAmount).toBe(prepayment);
  });

  it('микрозайм нельзя перевести в ежемесячный аннуитет через досрочку', async () => {
    mocks.findFirst.mockResolvedValue({ ...shortCredit(), type: 'MICROLOAN', termMonths: 1 });
    await expect(pay('2026-03-15T00:00:00.000Z', 5_000)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('досрочное погашение'),
    });
  });
});
