import { describe, expect, it } from 'vitest';
import { allocatePayment } from './paymentAllocation';

const base = {
  scheduledAmount: 1_000,
  scheduledPrincipal: 800,
  scheduledInterest: 200,
  paidBefore: 0,
  paidPrincipalBefore: 0,
  paidInterestBefore: 0,
  paidOverpaymentBefore: 0,
  outstanding: 5_000,
};

describe('allocatePayment', () => {
  it('keeps a partial payment open and preserves the unpaid remainder', () => {
    const result = allocatePayment({ ...base, amount: 400 });

    expect(result.status).toBe('PARTIALLY_PAID');
    expect(result.rowApplied).toBe(400);
    expect(result.totalPaid).toBe(400);
    expect(result.principalDelta).toBe(320);
    expect(result.interestDelta).toBe(80);
    expect(result.principalToBalance).toBe(320);
    expect(result.overpayment).toBe(0);
  });

  it('finishes the same row after a second partial payment without losing the first one', () => {
    const result = allocatePayment({
      ...base,
      paidBefore: 400,
      paidPrincipalBefore: 320,
      paidInterestBefore: 80,
      amount: 600,
    });

    expect(result.status).toBe('PAID');
    expect(result.totalPaid).toBe(1_000);
    expect(result.totalPrincipal).toBe(800);
    expect(result.totalInterest).toBe(200);
    expect(result.overpayment).toBe(0);
  });

  it('uses money above the row amount to pay existing debt, not as overpayment', () => {
    const result = allocatePayment({ ...base, amount: 1_500 });

    expect(result.rowExcess).toBe(500);
    expect(result.principalExtra).toBe(500);
    expect(result.principalToBalance).toBe(1_300);
    // 800 body + 200 interest of the row, 500 extra principal.
    expect(result.overpayment).toBe(0);
    expect(result.totalPaid).toBe(1_500);
    expect(result.totalPrincipal).toBe(1_300);
  });

  it('records only the excess above the whole debt as overpayment', () => {
    const result = allocatePayment({ ...base, outstanding: 8_000, amount: 10_000 });

    expect(result.principalToBalance).toBe(8_000);
    expect(result.overpayment).toBe(1_800);
    expect(result.totalPaid).toBe(10_000);
    // 800 традиционного тела строки уже включено в 8000 — не считаем дважды.
    expect(result.totalPrincipal).toBe(8_000);
    expect(result.status).toBe('PAID');
  });

  it('never decreases a zero balance and keeps all money in the overpayment ledger', () => {
    const result = allocatePayment({ ...base, outstanding: 0, amount: 1_000 });

    expect(result.principalToBalance).toBe(0);
    // 200 ₽ — всё ещё обязательство по процентам строки, не переплата.
    expect(result.overpayment).toBe(800);
    expect(result.totalOverpayment).toBe(800);
  });
});
