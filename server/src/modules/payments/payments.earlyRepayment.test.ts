import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middlewares/errorHandler';
import { paymentsService } from './payments.service';

const mocks = vi.hoisted(() => {
  const tx = {
    credit: { update: vi.fn() },
    paymentSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    paymentEvent: { create: vi.fn() },
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

// payments.service.ts:16 imports sendUniquePush from '../push/push.service'.
vi.mock('../push/push.service', () => ({
  sendUniquePush: mocks.sendPush,
}));

const CREDIT_ID = 'credit-1';
const USER_ID = 'user-1';

interface ScheduleItemFixture {
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

interface CreditFixture {
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
  schedule: ScheduleItemFixture[];
  events: unknown[];
}

function scheduleItem(
  k: number,
  status: 'PAID' | 'PENDING' = 'PENDING',
  overrides: Partial<ScheduleItemFixture> = {},
): ScheduleItemFixture {
  const dueDate = new Date(Date.UTC(2026, 1 + k, 1));
  return {
    id: `s${k}`,
    creditId: CREDIT_ID,
    dueDate,
    amount: 8000,
    principalPart: 7000,
    interestPart: 1000,
    status,
    paidAt: status === 'PAID' ? dueDate : null,
    paidAmount: status === 'PAID' ? 8000 : null,
    ...overrides,
  };
}

function makeCredit(overrides: Partial<CreditFixture> = {}): CreditFixture {
  const schedule = Array.from({ length: 12 }, (_, k) =>
    scheduleItem(k, k < 2 ? 'PAID' : 'PENDING'),
  );
  return {
    id: CREDIT_ID,
    userId: USER_ID,
    name: 'Test credit',
    status: 'ACTIVE',
    type: 'CONSUMER',
    termMonths: 12,
    startDate: new Date(Date.UTC(2026, 0, 1)),
    outstanding: 80_000,
    annualRate: 12,
    paymentType: 'ANNUITY',
    paymentDay: 1,
    principal: 100_000,
    prepaymentMode: 'REDUCE_TERM',
    schedule,
    events: [],
    ...overrides,
  };
}

function validDto() {
  return { amount: 10_000, date: new Date(Date.UTC(2026, 2, 15)) };
}

function appliedSplit() {
  const upsertCall = mocks.tx.paymentSchedule.upsert.mock.calls[0];
  if (upsertCall) {
    const arg = upsertCall[0] as any;
    return {
      principalPart: arg.update.principalPart.increment as number,
      interestPart: arg.update.interestPart.increment as number,
      amount: arg.create.amount as number,
    };
  }
  const createCall = mocks.tx.paymentSchedule.create.mock.calls[0];
  const arg = createCall[0] as any;
  return {
    principalPart: arg.data.principalPart as number,
    interestPart: arg.data.interestPart as number,
    amount: arg.data.amount as number,
  };
}

async function expectBothReject(credit: CreditFixture, dto: any, expected: any) {
  mocks.findFirst.mockResolvedValue(credit);
  await expect(paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject(expected);
  await expect(paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject(expected);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 2, 15)));
  vi.resetAllMocks();

  mocks.findFirst.mockResolvedValue(makeCredit());
  mocks.transaction.mockImplementation(async (cb: any) => cb(mocks.tx));

  mocks.tx.paymentSchedule.findUnique.mockResolvedValue(null);
  mocks.tx.paymentSchedule.update.mockResolvedValue({});
  mocks.tx.paymentSchedule.create.mockResolvedValue({});
  mocks.tx.paymentSchedule.upsert.mockResolvedValue({});
  mocks.tx.paymentSchedule.createMany.mockResolvedValue({ count: 0 });
  mocks.tx.paymentSchedule.deleteMany.mockResolvedValue({ count: 0 });
  mocks.tx.paymentEvent.create.mockResolvedValue({ id: 'evt-1' });
  mocks.tx.credit.update.mockImplementation(async ({ data }: any) => ({
    ...makeCredit(),
    ...data,
  }));
  mocks.sendPush.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('early repayment: guards and split parity', () => {
  it('rejects overpayment in both apply and preview', async () => {
    const dto = { amount: 80_000 + 368.22 + 100, date: new Date(Date.UTC(2026, 2, 15)) };
    await expect(paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('превышает'),
    });
    await expect(paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('превышает'),
    });
  });

  it('writes interestPart = accruedInterest and principalPart = outstanding on full repayment', async () => {
    const dto = { amount: 80_000 + 368.22, date: new Date(Date.UTC(2026, 2, 15)) };
    await paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto);
    const split = appliedSplit();
    expect(split.principalPart).toBe(80_000);
    expect(split.interestPart).toBe(368.22);
    expect(split.amount).toBe(80_368.22);
  });

  it('preview and apply return the same split for a partial repayment', async () => {
    const dto = validDto();
    const preview = await paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, dto);
    await paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto);
    const split = appliedSplit();
    expect(preview.accruedInterest).toBe(split.interestPart);
    expect(preview.principalPart).toBe(split.principalPart);
    expect(preview.effectiveDate).toBe('2026-03-15');
    expect(preview.coversInterest).toBe(true);
  });

  it('rejects a date before startDate in both apply and preview', async () => {
    const dto = { amount: 10_000, date: new Date(Date.UTC(2025, 11, 1)) };
    await expect(paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('раньше'),
    });
    await expect(paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('раньше'),
    });
  });

  it('preview reports coversInterest=false while apply rejects an amount below accrued interest', async () => {
    const dto = { amount: 100, date: new Date(Date.UTC(2026, 2, 15)) };
    const preview = await paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, dto);
    expect(preview.coversInterest).toBe(false);
    expect(preview.minAmount).toBe(368.23);
    expect(preview.principalPart).toBe(-268.22);
    await expect(paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('не покрывает'),
    });
  });

  it('rounds amount identically in preview and apply', async () => {
    const dto = { amount: 10_000.005, date: new Date(Date.UTC(2026, 2, 15)) };
    const preview = await paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, dto);
    await paymentsService.earlyRepayment(USER_ID, CREDIT_ID, dto);
    const split = appliedSplit();
    expect(preview.amount).toBe(10_000);
    expect(split.amount).toBe(10_000);
    expect(preview.principalPart).toBe(split.principalPart);
  });
});

describe('early repayment: anchor', () => {
  it('does not use a future PAID installment as anchor', async () => {
    const credit = makeCredit();
    credit.schedule.push(
      scheduleItem(3, 'PAID', {
        dueDate: new Date(Date.UTC(2026, 3, 1)),
        paidAt: new Date(Date.UTC(2026, 2, 10)),
      }),
    );
    mocks.findFirst.mockResolvedValue(credit);
    const preview = await paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, validDto());
    expect(preview.days).toBe(14);
    expect(preview.accruedInterest).toBe(368.22);
  });

  it('uses dueDate when paidAt is later (current behavior, deferred to paidAt migration)', async () => {
    const credit = makeCredit();
    credit.schedule[1] = { ...credit.schedule[1], paidAt: new Date(Date.UTC(2026, 2, 20)) };
    mocks.findFirst.mockResolvedValue(credit);
    const preview = await paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, validDto());
    // current behavior, deferred to paidAt migration
    expect(preview.days).toBe(14);
    expect(preview.accruedInterest).toBe(368.22);
  });

  it('excludes a future-due PAID installment even when paidAt is today (current behavior, deferred)', async () => {
    const credit = makeCredit();
    credit.schedule.push(
      scheduleItem(3, 'PAID', {
        dueDate: new Date(Date.UTC(2026, 3, 1)),
        paidAt: new Date(Date.UTC(2026, 2, 15)),
      }),
    );
    mocks.findFirst.mockResolvedValue(credit);
    const preview = await paymentsService.previewEarlyRepayment(USER_ID, CREDIT_ID, validDto());
    // current behavior, deferred to paidAt migration
    expect(preview.days).toBe(14);
    expect(preview.accruedInterest).toBe(368.22);
  });
});

describe('early repayment: guard parity for unsupported credits', () => {
  it('rejects CLOSED credits in both apply and preview', async () => {
    await expectBothReject(makeCredit({ status: 'CLOSED' }), validDto(), {
      statusCode: 409,
      message: 'Кредит уже закрыт',
    });
  });

  it('rejects LOAN credits in both apply and preview', async () => {
    await expectBothReject(makeCredit({ type: 'LOAN' }), validDto(), {
      statusCode: 400,
      message: expect.stringContaining('частного займа'),
    });
  });

  it('rejects CREDIT_CARD credits in both apply and preview', async () => {
    await expectBothReject(makeCredit({ type: 'CREDIT_CARD' }), validDto(), {
      statusCode: 400,
      message: expect.stringContaining('кредитной карты'),
    });
  });

  it('rejects credits without a term in both apply and preview', async () => {
    await expectBothReject(makeCredit({ termMonths: 0 }), validDto(), {
      statusCode: 400,
      message: expect.stringContaining('не указан срок'),
    });
  });
});
