import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditsService } from './credits.service';

/** Редактирование кредита не должно стирать оплаченную историю и досрочки. */

const mocks = vi.hoisted(() => {
  const tx = {
    credit: { update: vi.fn() },
    paymentSchedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
  return {
    tx,
    findFirst: vi.fn(),
    transaction: vi.fn(),
  };
});

vi.mock('../../config/prisma', () => ({
  prisma: {
    credit: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));

const USER_ID = 'update-user';
const CREDIT_ID = 'credit-with-history';

const paidRows = [
  {
    creditId: CREDIT_ID,
    dueDate: new Date(Date.UTC(2024, 0, 1)),
    amount: 20_000,
    principalPart: 15_000,
    status: 'PAID',
    paidAmount: 20_000,
  },
  {
    creditId: CREDIT_ID,
    dueDate: new Date(Date.UTC(2024, 6, 1)),
    amount: 100_000,
    principalPart: 100_000,
    status: 'PAID',
    paidAmount: 100_000,
  },
];

const currentCredit = {
  id: CREDIT_ID,
  userId: USER_ID,
  name: 'Кредит с историей',
  type: 'CONSUMER',
  paymentType: 'ANNUITY',
  principal: 1_000_000,
  annualRate: 20,
  startDate: new Date(Date.UTC(2024, 0, 1)),
  termMonths: 60,
  paymentDay: 1,
  minPayment: null,
  gracePeriodEnds: null,
  graceReplenishSum: null,
  graceReplenishDay: null,
  frozen: false,
  outstanding: 700_000,
  totalPaid: 300_000,
  freezeCycleDays: null,
  nextFreezeCheckAt: null,
  freezeStartedAt: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 2, 15)));
  vi.resetAllMocks();

  mocks.findFirst.mockResolvedValue(currentCredit);
  mocks.transaction.mockImplementation(async (cb: any) => cb(mocks.tx));
  mocks.tx.credit.update.mockImplementation(async ({ data }: any) => ({
    ...currentCredit,
    ...data,
  }));
  mocks.tx.paymentSchedule.findMany.mockResolvedValue(paidRows);
  mocks.tx.paymentSchedule.findFirst.mockResolvedValue({
    creditId: CREDIT_ID,
    dueDate: new Date(Date.UTC(2024, 7, 1)),
    amount: 20_000,
    principalPart: 15_000,
  });
  mocks.tx.paymentSchedule.deleteMany.mockResolvedValue({ count: 58 });
  mocks.tx.paymentSchedule.createMany.mockResolvedValue({ count: 58 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('редактирование кредита с оплаченной историей', () => {
  it('сохраняет PAID-строки, не воскрешает платежи после досрочки и возвращает свежий остаток', async () => {
    const result = await creditsService.update(USER_ID, CREDIT_ID, {
      annualRate: 21,
      markPastAsPaid: true,
    } as any);

    const deleteWhere = (mocks.tx.paymentSchedule.deleteMany.mock.calls[0]?.[0] as any)?.where;
    expect(deleteWhere).toEqual({ creditId: CREDIT_ID, status: 'PENDING' });

    const created = (mocks.tx.paymentSchedule.createMany.mock.calls[0]?.[0] as any)?.data ?? [];
    const dates = created.map((row: any) => new Date(row.dueDate).toISOString().slice(0, 10));
    expect(dates).not.toContain('2024-01-01');
    expect(dates).not.toContain('2024-07-01');
    expect(created.some((row: any) => row.status === 'PAID')).toBe(true);
    expect(created.some((row: any) => row.status === 'PENDING')).toBe(true);
    expect(created.every((row: any) => row.dueDate > paidRows[1].dueDate || row.status === 'PAID')).toBe(true);

    const finalUpdate = mocks.tx.credit.update.mock.calls.at(-1)?.[0] as any;
    expect(finalUpdate.data).toHaveProperty('outstanding');
    expect(result.outstanding).toBe(finalUpdate.data.outstanding);
  });

  it('ручная правка только остатка не пересобирает график', async () => {
    await creditsService.update(USER_ID, CREDIT_ID, {
      outstanding: 650_000,
      markPastAsPaid: false,
    } as any);

    expect(mocks.tx.paymentSchedule.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.paymentSchedule.createMany).not.toHaveBeenCalled();
    const lastData = (mocks.tx.credit.update.mock.calls.at(-1)?.[0] as any)?.data ?? {};
    expect(lastData).toEqual({ outstanding: 650_000 });
  });

  it('freeze/unfreeze не пересобирает график и не трогает баланс', async () => {
    await creditsService.update(USER_ID, CREDIT_ID, { frozen: true } as any);

    expect(mocks.tx.paymentSchedule.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.paymentSchedule.createMany).not.toHaveBeenCalled();
    const data = (mocks.tx.credit.update.mock.calls[0]?.[0] as any)?.data ?? {};
    expect(data).not.toHaveProperty('outstanding');
    expect(data).not.toHaveProperty('totalPaid');
  });
});
