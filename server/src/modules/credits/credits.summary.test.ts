import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditsService } from './credits.service';

// Фиксированная «сегодня»: 07.11.2026 (ноябрь). Ближайший платёж — 28.12.2026.
const TODAY_NOV = new Date(Date.UTC(2026, 10, 7));
// Декабрь: 15.12.2026 — платёж 28.12 попадает в текущий месяц.
const TODAY_DEC = new Date(Date.UTC(2026, 11, 15));

const mocks = vi.hoisted(() => ({
  creditFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  paymentEventAggregate: vi.fn(),
  utcToday: vi.fn(() => TODAY_NOV),
}));

vi.mock('../../config/prisma', () => ({
  prisma: {
    credit: { findMany: mocks.creditFindMany },
    user: { findUnique: mocks.userFindUnique },
    paymentEvent: { aggregate: mocks.paymentEventAggregate },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        credit: { update: vi.fn() },
        paymentSchedule: {
          findMany: vi.fn(),
          count: vi.fn(),
          findFirst: vi.fn(),
          createMany: vi.fn(),
          deleteMany: vi.fn(),
          upsert: vi.fn(),
        },
        paymentEvent: { create: vi.fn() },
      };
      return fn(tx);
    }),
  },
}));

vi.mock('../../utils/finance/date', () => ({
  utcToday: mocks.utcToday,
  addMonths: vi.fn((d: Date, m: number) => {
    const res = new Date(d);
    res.setUTCMonth(res.getUTCMonth() + m);
    return res;
  }),
  monthsBetween: vi.fn((from: Date, to: Date) => {
    return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  }),
  addUTCDays: vi.fn((d: Date, days: number) => {
    const res = new Date(d);
    res.setUTCDate(res.getUTCDate() + days);
    return res;
  }),
}));

function installment(dueDate: Date, amount: number, status = 'PENDING'): any {
  return {
    id: 'installment-1',
    creditId: 'credit-1',
    dueDate,
    amount,
    principalPart: amount * 0.8,
    interestPart: amount * 0.2,
    status,
    paidAt: null,
    paidAmount: null,
  };
}

const baseCredit: any = {
  id: 'credit-1',
  userId: 'user-1',
  name: 'СберКредитка',
  type: 'CONSUMER',
  paymentType: 'ANNUITY',
  prepaymentMode: 'REDUCE_TERM',
  principal: 225_500,
  outstanding: 225_500,
  annualRate: 29.9,
  startDate: new Date(Date.UTC(2026, 0, 15)),
  termMonths: 36,
  paymentDay: 28,
  minPayment: null,
  gracePeriodEnds: null,
  graceReplenishSum: null,
  graceReplenishDay: null,
  frozen: false,
  freezeCycleDays: null,
  freezeStartedAt: null,
  nextFreezeCheckAt: null,
  status: 'ACTIVE',
  closedAt: null,
  totalPaid: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let mockCredit: any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.utcToday.mockReturnValue(TODAY_NOV);
  mockCredit = { ...baseCredit, schedule: [installment(new Date(Date.UTC(2026, 11, 28)), 8147.98)] };
  mocks.creditFindMany.mockResolvedValue([mockCredit]);
  mocks.userFindUnique.mockResolvedValue({ monthlyIncome: null });
  mocks.paymentEventAggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
});

describe('creditsService.summary — monthlyPayments по правилу 2', () => {
  it('ноябрь 2026: платёж 28 декабря не входит в текущий месяц → 0 ₽', async () => {
    mocks.utcToday.mockReturnValue(TODAY_NOV);
    mockCredit = { ...baseCredit, schedule: [installment(new Date(Date.UTC(2026, 11, 28)), 8147.98)] };
    mocks.creditFindMany.mockResolvedValue([mockCredit]);

    const result = await creditsService.summary('user-1');
    expect(result.monthlyPayments).toBe(0);
  });

  it('декабрь 2026: платёж 28 декабря входит в текущий месяц → 8147,98 ₽', async () => {
    mocks.utcToday.mockReturnValue(TODAY_DEC);
    mockCredit = { ...baseCredit, schedule: [installment(new Date(Date.UTC(2026, 11, 28)), 8147.98)] };
    mocks.creditFindMany.mockResolvedValue([mockCredit]);

    const result = await creditsService.summary('user-1');
    expect(result.monthlyPayments).toBe(8147.98);
  });

  it('ноябрь 2026: два платежа, только ноябрьский считается → 5000 ₽', async () => {
    mocks.utcToday.mockReturnValue(TODAY_NOV);
    mockCredit = {
      ...baseCredit,
      schedule: [
        installment(new Date(Date.UTC(2026, 10, 15)), 5000), // ноябрь
        installment(new Date(Date.UTC(2026, 11, 28)), 8147.98), // декабрь — не считается
      ],
    };
    mocks.creditFindMany.mockResolvedValue([mockCredit]);

    const result = await creditsService.summary('user-1');
    expect(result.monthlyPayments).toBe(5000);
  });
});
