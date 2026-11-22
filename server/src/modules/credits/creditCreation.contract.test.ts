import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCreditSchema } from './credits.schemas';
import { creditsService } from './credits.service';

/**
 * Контракт добавления кредита: то, что разрешает форма, должно принимать API,
 * а исторические досрочки не должны затирать уже учтённую оплату.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    credit: { create: vi.fn(), update: vi.fn() },
    paymentSchedule: { createMany: vi.fn(), deleteMany: vi.fn() },
    paymentEvent: { createMany: vi.fn() },
  };
  return {
    tx,
    create: vi.fn(),
    transaction: vi.fn(),
  };
});

vi.mock('../../config/prisma', () => ({
  prisma: {
    credit: { create: mocks.create },
    $transaction: mocks.transaction,
  },
}));

const USER_ID = 'creation-user';

function installmentFromClient() {
  // ровно то, что отправляет AddCreditPage для рассрочки (срок только в днях)
  return {
    name: 'Рассрочка в днях',
    type: 'INSTALLMENT',
    principal: 120_000,
    annualRate: 0,
    termDays: 90,
    paymentDay: 15,
    earlyRepayments: [],
    frozen: false,
    markPastAsPaid: false,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 2, 15)));
  vi.resetAllMocks();

  mocks.create.mockImplementation(async ({ data }: any) => ({ id: 'new-credit', ...data }));
  mocks.transaction.mockImplementation(async (cb: any) => cb(mocks.tx));
  mocks.tx.credit.create.mockImplementation(async ({ data }: any) => ({ id: 'new-credit', ...data }));
  mocks.tx.credit.update.mockImplementation(async ({ data }: any) => ({ id: 'new-credit', ...data }));
  mocks.tx.paymentSchedule.createMany.mockResolvedValue({ count: 60 });
  mocks.tx.paymentSchedule.deleteMany.mockResolvedValue({ count: 60 });
  mocks.tx.paymentEvent.createMany.mockResolvedValue({ count: 6 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('добавление кредита', () => {
  it('рассрочка со сроком в днях принимается API так же, как формой', () => {
    const parsed = createCreditSchema.safeParse(installmentFromClient());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.termMonths).toBeGreaterThan(0);
    }
  });

  it('история досрочек не отменяет отмеченные как оплаченные платежи и не занижает остаток в ответе', async () => {
    const result = await creditsService.create(USER_ID, {
      name: 'Кредит с историей',
      type: 'CONSUMER',
      paymentType: 'ANNUITY',
      principal: 1_000_000,
      annualRate: 20,
      startDate: new Date(Date.UTC(2024, 0, 1)),
      termMonths: 60,
      paymentDay: 1,
      markPastAsPaid: true,
      earlyRepayments: [{ amount: 100_000, date: new Date(Date.UTC(2024, 6, 1)) }],
    } as any);

    const updateCalls = mocks.tx.credit.update.mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);
    const recalculated = (updateCalls[0][0] as any).data.outstanding as number;
    expect(recalculated).toBeLessThan(1_000_000);

    // Ответ API должен содержать тот остаток, который реально записан в БД.
    expect(result.outstanding).toBe(recalculated);

    // График после пересборки не должен превращать оплаченные строки в неоплаченные.
    const allCreatedStatuses = mocks.tx.paymentSchedule.createMany.mock.calls.flatMap(
      (call) => ((call[0] as any).data ?? []).map((item: any) => item.status),
    );
    expect(allCreatedStatuses).toContain('PAID');
    expect(allCreatedStatuses.filter((status) => status === 'PENDING').length).toBeGreaterThan(0);

    const deleteWhere = (mocks.tx.paymentSchedule.deleteMany.mock.calls.at(-1)?.[0] as any)?.where;
    expect(deleteWhere).toMatchObject({ creditId: 'new-credit', status: 'PENDING' });

    const finalCreate = mocks.tx.paymentSchedule.createMany.mock.calls.at(-1)?.[0] as any;
    expect((finalCreate?.data ?? []).every((item: any) => item.status === 'PENDING')).toBe(true);
  });
});
