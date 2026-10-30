import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditsService } from './credits.service';
import { AppError } from '../../middlewares/errorHandler';

vi.mock('../../config/prisma', () => {
  const txMocks = {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    createPaymentEvent: vi.fn(),
    transaction: vi.fn(),
  };
  (globalThis as any).__renewMocks = txMocks;
  (globalThis as any).__currentCredit = {
    id: 'credit-1',
    userId: 'user-1',
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 40_000,
    outstanding: 15_000,
    nextFreezeCheckAt: null,
  };

  return {
    prisma: {
      credit: {
        findFirst: vi.fn(async () => (globalThis as any).__currentCredit),
        updateMany: txMocks.updateMany,
        findUnique: txMocks.findUnique,
      },
      paymentEvent: {
        create: txMocks.createPaymentEvent,
      },
      $transaction: txMocks.transaction,
    },
  };
});

const txMocks = (globalThis as any).__renewMocks;

beforeEach(() => {
  (globalThis as any).__currentCredit = {
    id: 'credit-1',
    userId: 'user-1',
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 40_000,
    outstanding: 15_000,
    nextFreezeCheckAt: null,
  };
  txMocks.transaction.mockImplementation((fn: any) =>
    fn({
      credit: {
        updateMany: txMocks.updateMany,
        findUnique: txMocks.findUnique,
      },
      paymentEvent: {
        create: txMocks.createPaymentEvent,
      },
    })
  );
  txMocks.updateMany.mockResolvedValue({ count: 1 });
  txMocks.findUnique.mockImplementation(async () => ({ ...(globalThis as any).__currentCredit }));
  txMocks.createPaymentEvent.mockResolvedValue({ id: 'event-1' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('renewFreezeCycle idempotency (mocked DB path)', () => {
  it('allows first renewal when nextFreezeCheckAt is null and creates one event', async () => {
    (globalThis as any).__currentCredit = {
      id: 'credit-1',
      userId: 'user-1',
      frozen: true,
      freezeCycleDays: 30,
      graceReplenishSum: 40_000,
      outstanding: 15_000,
      nextFreezeCheckAt: null,
    };
    txMocks.updateMany.mockResolvedValue({ count: 1 });
    await expect(creditsService.renewFreezeCycle('user-1', 'credit-1')).resolves.toBeTruthy();
    expect(txMocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'credit-1',
        userId: 'user-1',
        frozen: true,
      }),
    }));
    expect(txMocks.createPaymentEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects an early renewal when nextFreezeCheckAt is in the future', async () => {
    (globalThis as any).__currentCredit = {
      id: 'credit-1',
      userId: 'user-1',
      frozen: true,
      freezeCycleDays: 30,
      graceReplenishSum: 40_000,
      outstanding: 15_000,
      nextFreezeCheckAt: new Date(Date.UTC(2026, 11, 31)),
    };
    txMocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(creditsService.renewFreezeCycle('user-1', 'credit-1')).rejects.toThrow(AppError);
    expect(txMocks.createPaymentEvent).not.toHaveBeenCalled();
  });

  it('allows renewal when nextFreezeCheckAt is today', async () => {
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    (globalThis as any).__currentCredit = {
      id: 'credit-1',
      userId: 'user-1',
      frozen: true,
      freezeCycleDays: 30,
      graceReplenishSum: 40_000,
      outstanding: 15_000,
      nextFreezeCheckAt: today,
    };
    txMocks.updateMany.mockResolvedValue({ count: 1 });
    await expect(creditsService.renewFreezeCycle('user-1', 'credit-1')).resolves.toBeTruthy();
    expect(txMocks.createPaymentEvent).toHaveBeenCalledTimes(1);
  });

  it('a second renewal with count=0 does not record another event', async () => {
    (globalThis as any).__currentCredit = {
      id: 'credit-1',
      userId: 'user-1',
      frozen: true,
      freezeCycleDays: 30,
      graceReplenishSum: 40_000,
      outstanding: 15_000,
      nextFreezeCheckAt: null,
    };
    txMocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await creditsService.renewFreezeCycle('user-1', 'credit-1');
    await expect(creditsService.renewFreezeCycle('user-1', 'credit-1')).rejects.toThrow(AppError);
    expect(txMocks.createPaymentEvent).toHaveBeenCalledTimes(1);
  });

  it('zero amount rolls dates but does not create a PaymentEvent', async () => {
    (globalThis as any).__currentCredit = {
      id: 'credit-1',
      userId: 'user-1',
      frozen: true,
      freezeCycleDays: 30,
      graceReplenishSum: 0,
      outstanding: 15_000,
      nextFreezeCheckAt: null,
    };
    txMocks.updateMany.mockResolvedValue({ count: 1 });
    await creditsService.renewFreezeCycle('user-1', 'credit-1');
    expect(txMocks.createPaymentEvent).not.toHaveBeenCalled();
  });

  it('unfrozen card is rejected and updateMany is not called', async () => {
    (globalThis as any).__currentCredit = {
      id: 'credit-1',
      userId: 'user-1',
      frozen: false,
      freezeCycleDays: 30,
      graceReplenishSum: 40_000,
      outstanding: 15_000,
      nextFreezeCheckAt: null,
    };
    await expect(creditsService.renewFreezeCycle('user-1', 'credit-1')).rejects.toThrow(AppError);
    expect(txMocks.updateMany).not.toHaveBeenCalled();
  });
});
