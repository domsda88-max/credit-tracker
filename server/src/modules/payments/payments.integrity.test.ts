import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentsService } from './payments.service';

/**
 * Целостность финансовых операций. Все данные синтетические: Prisma и push
 * подменены, реальная база не трогается.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    credit: { update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    paymentSchedule: {
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    paymentEvent: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return {
    tx,
    transaction: vi.fn(),
    findInstallment: vi.fn(),
    creditFindMany: vi.fn(),
    scheduleFindMany: vi.fn(),
    auditUpsert: vi.fn(),
    sendPush: vi.fn(),
    state: { credit: {} as Record<string, any> },
  };
});

vi.mock('../../config/prisma', () => ({
  prisma: {
    credit: { findMany: mocks.creditFindMany },
    paymentSchedule: { findUnique: mocks.findInstallment, findMany: mocks.scheduleFindMany },
    auditEvent: { upsert: mocks.auditUpsert },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../push/push.service', () => ({ sendUniquePush: mocks.sendPush }));

const USER_ID = 'user-1';
const CREDIT_ID = 'credit-1';
const INSTALLMENT_ID = 's1';

function applyMoneyUpdate(data: Record<string, any>): void {
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in (value as any)) {
      const current = Number(mocks.state.credit[field] ?? 0);
      mocks.state.credit[field] = current + Number((value as any).increment);
    } else if (value && typeof value === 'object' && 'decrement' in (value as any)) {
      const current = Number(mocks.state.credit[field] ?? 0);
      mocks.state.credit[field] = Math.max(0, current - Number((value as any).decrement));
    } else {
      mocks.state.credit[field] = value;
    }
  }
}

function creditFixture(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: CREDIT_ID,
    userId: USER_ID,
    name: 'Тестовый кредит',
    status: 'ACTIVE',
    type: 'CONSUMER',
    principal: 100_000,
    outstanding: 5_000,
    totalPaid: 0,
    overpaymentBalance: 0,
    paymentType: 'ANNUITY',
    closedAt: null,
    ...overrides,
  };
}

function installmentFixture(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: INSTALLMENT_ID,
    creditId: CREDIT_ID,
    amount: 1_000,
    principalPart: 800,
    interestPart: 200,
    status: 'PENDING',
    paidAt: null,
    paidAmount: null,
    paidPrincipalPart: null,
    paidInterestPart: null,
    paidOverpayment: null,
    credit: creditFixture(),
    ...overrides,
  };
}

/** Строка графика в том виде, в котором импорт читает её из БД. */
function scheduleFixture(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: INSTALLMENT_ID,
    creditId: CREDIT_ID,
    dueDate: new Date('2026-03-01T00:00:00.000Z'),
    amount: 1_000,
    principalPart: 800,
    interestPart: 200,
    status: 'PENDING',
    paidAmount: null,
    paidPrincipalPart: null,
    paidInterestPart: null,
    paidOverpayment: null,
    ...overrides,
  };
}

function seed(
  creditOverrides: Record<string, any> = {},
  installmentOverrides: Record<string, any> = {},
): void {
  const credit = creditFixture(creditOverrides);
  mocks.state.credit = { ...credit };
  mocks.findInstallment.mockResolvedValue(
    installmentFixture({ credit, ...installmentOverrides }),
  );
}

function eventData(): Array<Record<string, any>> {
  return mocks.tx.paymentEvent.create.mock.calls.map((call) => (call[0] as any).data);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: any) => cb(mocks.tx));
  mocks.tx.credit.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.credit.findUnique.mockImplementation(async () => ({ ...mocks.state.credit }));
  mocks.creditFindMany.mockResolvedValue([creditFixture()]);
  mocks.scheduleFindMany.mockResolvedValue([]);
  mocks.tx.credit.update.mockImplementation(async ({ data }: any) => {
    applyMoneyUpdate(data);
    return { ...mocks.state.credit };
  });
  mocks.tx.paymentSchedule.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.paymentSchedule.update.mockResolvedValue({});
  mocks.tx.paymentSchedule.deleteMany.mockResolvedValue({ count: 0 });
  mocks.tx.paymentEvent.findFirst.mockResolvedValue(null);
  mocks.tx.paymentEvent.create.mockResolvedValue({ id: 'event-1' });
  mocks.tx.paymentEvent.updateMany.mockResolvedValue({ count: 1 });
  mocks.auditUpsert.mockResolvedValue({});
  mocks.sendPush.mockResolvedValue(undefined);
  seed();
});

describe('payInstallment — частичная оплата и переплата', () => {
  it('не помечает всю строку PAID при недоплате и сохраняет разницу', async () => {
    seed();
    await paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 400 });

    const claim = mocks.tx.paymentSchedule.updateMany.mock.calls[0][0] as any;
    expect(claim.where).toMatchObject({ id: INSTALLMENT_ID, status: { in: ['PENDING', 'PARTIALLY_PAID'] } });
    expect(claim.data).toMatchObject({
      status: 'PARTIALLY_PAID',
      paidAmount: 400,
      paidPrincipalPart: 320,
      paidInterestPart: 80,
    });

    const creditUpdate = mocks.tx.credit.update.mock.calls[0][0] as any;
    expect(creditUpdate.data.outstanding).toEqual({ decrement: 320 });
    expect(creditUpdate.data.totalPaid).toEqual({ increment: 400 });
    expect(creditUpdate.data.overpaymentBalance).toEqual({ increment: 0 });

    const events = eventData();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'SCHEDULED', amount: 400 });
  });

  it('records money above the whole debt as overpayment and closes at zero', async () => {
    seed({ outstanding: 8_000 });
    await paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 10_000 });

    const events = eventData();
    expect(events).toHaveLength(2);
    expect(events.reduce((sum, event) => sum + event.amount, 0)).toBe(10_000);
    expect(events.find((event) => event.kind === 'OVERPAYMENT')).toMatchObject({ amount: 1_800 });

    const firstCreditUpdate = mocks.tx.credit.update.mock.calls[0][0] as any;
    expect(firstCreditUpdate.data.outstanding).toEqual({ decrement: 8_000 });
    expect(firstCreditUpdate.data.overpaymentBalance).toEqual({ increment: 1_800 });
    // Остаток не ушёл в минус, кредит закрыт.
    expect(mocks.state.credit.outstanding).toBe(0);
    expect(mocks.state.credit.status).toBe('CLOSED');
    expect(mocks.tx.paymentSchedule.deleteMany).toHaveBeenCalled();
  });

  it('accepts money above the row when the credit still owes that money', async () => {
    seed({ outstanding: 5_000 });
    await paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 1_500 });

    const creditUpdate = mocks.tx.credit.update.mock.calls[0][0] as any;
    expect(creditUpdate.data.outstanding).toEqual({ decrement: 1_300 });
    expect(creditUpdate.data.overpaymentBalance).toEqual({ increment: 0 });
    expect(eventData()).toHaveLength(1);
    expect(eventData()[0].amount).toBe(1_500);
  });
});

describe('cancelPayment', () => {
  it('restores an ordinary payment and marks its events cancelled without deleting history', async () => {
    seed(
      { outstanding: 9_200, totalPaid: 1_000 },
      {
        status: 'PAID',
        paidAt: new Date('2026-03-01T00:00:00.000Z'),
        paidAmount: 1_000,
        paidPrincipalPart: 800,
        paidInterestPart: 200,
      },
    );

    await paymentsService.cancelPayment(USER_ID, INSTALLMENT_ID);

    const claim = mocks.tx.paymentSchedule.updateMany.mock.calls[0][0] as any;
    expect(claim.data.status).toBe('PENDING');
    const creditUpdate = mocks.tx.credit.update.mock.calls[0][0] as any;
    expect(creditUpdate.data.outstanding).toEqual({ increment: 800 });
    expect(creditUpdate.data.totalPaid).toEqual({ decrement: 1_000 });
    expect(mocks.tx.paymentEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheduleId: INSTALLMENT_ID, cancelledAt: null } }),
    );
    expect(mocks.tx.paymentEvent.create).not.toHaveBeenCalled();
    expect(mocks.auditUpsert).not.toHaveBeenCalled();
  });

  it('restores only the actually paid part of a partial payment', async () => {
    seed(
      { outstanding: 9_680, totalPaid: 400 },
      {
        status: 'PARTIALLY_PAID',
        paidAt: new Date('2026-03-01T00:00:00.000Z'),
        paidAmount: 400,
        paidPrincipalPart: 320,
        paidInterestPart: 80,
      },
    );

    await paymentsService.cancelPayment(USER_ID, INSTALLMENT_ID);

    const creditUpdate = mocks.tx.credit.update.mock.calls[0][0] as any;
    expect(creditUpdate.data.outstanding).toEqual({ increment: 320 });
    expect(creditUpdate.data.totalPaid).toEqual({ decrement: 400 });
  });

  it('blocks cancellation of the payment that closed the credit and writes a deduplicated audit', async () => {
    seed(
      { status: 'CLOSED', outstanding: 0, totalPaid: 1_000, closedAt: new Date() },
      {
        status: 'PAID',
        paidAt: new Date('2026-03-01T00:00:00.000Z'),
        paidAmount: 1_000,
        paidPrincipalPart: 800,
        paidInterestPart: 200,
      },
    );

    await expect(
      paymentsService.cancelPayment(USER_ID, INSTALLMENT_ID),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Нельзя отменить платёж, которым был полностью закрыт кредит',
    });
    await expect(
      paymentsService.cancelPayment(USER_ID, INSTALLMENT_ID),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.auditUpsert).toHaveBeenCalledTimes(2);
    const keys = mocks.auditUpsert.mock.calls.map((call) => (call[0] as any).where.dedupKey);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(`${USER_ID}:CANCEL_BLOCKED:${INSTALLMENT_ID}`);
    expect(mocks.tx.paymentSchedule.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.credit.update).not.toHaveBeenCalled();
    expect(mocks.state.credit.outstanding).toBe(0);
    expect(mocks.state.credit.totalPaid).toBe(1_000);
    expect(mocks.state.credit.status).toBe('CLOSED');
  });
});

describe('payInstallment — защита от гонок и повторов', () => {
  it('rejects a repeated request with the same idempotency key', async () => {
    seed();
    mocks.tx.paymentEvent.findFirst.mockResolvedValue({ id: 'old-event' });

    await expect(
      paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 400 }, 'retry-key'),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('уже применён') });

    expect(mocks.tx.paymentEvent.findFirst).toHaveBeenCalledWith({
      where: { idempotencyKey: `${USER_ID}:pay:${INSTALLMENT_ID}:retry-key` },
    });
    expect(mocks.tx.paymentSchedule.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.credit.update).not.toHaveBeenCalled();
  });

  it('does not apply the same installment twice when two requests race', async () => {
    seed();
    mocks.tx.paymentSchedule.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 400 });
    await expect(
      paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 400 }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.tx.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(mocks.state.credit.totalPaid).toBe(400);
  });

  it('aborts when the credit balance changed after the request read it', async () => {
    seed();
    mocks.tx.credit.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      paymentsService.payInstallment(USER_ID, INSTALLMENT_ID, { amount: 400 }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('изменились') });

    expect(mocks.tx.paymentSchedule.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.credit.update).not.toHaveBeenCalled();
  });
});

describe('importPayments — целостность последовательных строк', () => {
  it('перечитывает остаток между строками одного кредита и отделяет переплату', async () => {
    seed({ outstanding: 1_000 });
    mocks.creditFindMany.mockResolvedValue([creditFixture({ outstanding: 1_000 })]);
    mocks.scheduleFindMany.mockResolvedValue([
      scheduleFixture({ id: 's1', dueDate: new Date('2026-03-01T00:00:00.000Z') }),
      scheduleFixture({ id: 's2', dueDate: new Date('2026-04-01T00:00:00.000Z') }),
    ]);

    const result = await paymentsService.importPayments(USER_ID, {
      rows: [
        {
          creditId: CREDIT_ID,
          creditName: 'Тестовый кредит',
          dueDate: '2026-03-01',
          amount: 600,
        },
        {
          creditId: CREDIT_ID,
          creditName: 'Тестовый кредит',
          dueDate: '2026-04-01',
          amount: 1_000,
        },
      ],
    });

    expect(result).toMatchObject({ created: 2, skipped: 0, failed: [] });
    // Первое чтение — внутри транзакции; дальше используется обновлённый
    // outstanding из credit.update, а не снимок, сделанный до импорта.
    expect(mocks.tx.credit.findUnique).toHaveBeenCalledTimes(1);

    const updates = mocks.tx.credit.update.mock.calls.map((call) => (call[0] as any).data);
    expect(updates[0].outstanding).toEqual({ decrement: 480 });
    expect(updates[0].overpaymentBalance).toEqual({ increment: 0 });
    // Вторая строка видит уже уменьшенный остаток 520, а не исходные 1000.
    expect(updates[1].outstanding).toEqual({ decrement: 520 });
    expect(updates[1].overpaymentBalance).toEqual({ increment: 280 });

    expect(mocks.state.credit.outstanding).toBe(0);
    expect(mocks.state.credit.status).toBe('CLOSED');
    expect(mocks.state.credit.overpaymentBalance).toBe(280);

    const events = eventData();
    expect(events.reduce((sum, event) => sum + event.amount, 0)).toBe(1_600);
    expect(events.find((event) => event.kind === 'OVERPAYMENT')).toMatchObject({ amount: 280 });
  });
});
