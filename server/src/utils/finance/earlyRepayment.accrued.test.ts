import { describe, expect, it } from 'vitest';
import { AppError } from '../../middlewares/errorHandler';
import {
  accruedInterestFor,
  assertAmountWithinOutstanding,
  assertPrepaymentDate,
  prepaymentAnchorDate,
} from './earlyRepayment';

describe('accruedInterestFor', () => {
  it('counts whole UTC days and rounds to kopecks', () => {
    const from = new Date(Date.UTC(2026, 2, 1));
    const to = new Date(Date.UTC(2026, 2, 15));
    const result = accruedInterestFor(80_000, 12, from, to);
    expect(result.days).toBe(14);
    expect(result.accruedInterest).toBe(368.22);
  });

  it('returns zero interest for a zero rate', () => {
    const result = accruedInterestFor(
      80_000,
      0,
      new Date(Date.UTC(2026, 2, 1)),
      new Date(Date.UTC(2026, 2, 15)),
    );
    expect(result).toEqual({ accruedInterest: 0, days: 14 });
  });

  it('clamps a negative interval to zero days', () => {
    const result = accruedInterestFor(
      80_000,
      12,
      new Date(Date.UTC(2026, 2, 15)),
      new Date(Date.UTC(2026, 2, 1)),
    );
    expect(result).toEqual({ accruedInterest: 0, days: 0 });
  });
});

describe('prepaymentAnchorDate', () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  const prepayment = new Date(Date.UTC(2026, 2, 15));

  it('uses the last PAID installment with dueDate <= prepayment date', () => {
    const schedule = [
      { status: 'PAID', dueDate: new Date(Date.UTC(2026, 1, 1)) },
      { status: 'PAID', dueDate: new Date(Date.UTC(2026, 2, 1)) },
      { status: 'PAID', dueDate: new Date(Date.UTC(2026, 3, 1)) },
    ];
    expect(prepaymentAnchorDate(schedule, prepayment, start).toISOString().slice(0, 10)).toBe(
      '2026-03-01',
    );
  });

  it('falls back to startDate when there are no PAID installments', () => {
    expect(prepaymentAnchorDate([], prepayment, start).toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('ignores non-PAID installments', () => {
    const schedule = [{ status: 'PENDING', dueDate: new Date(Date.UTC(2026, 2, 1)) }];
    expect(prepaymentAnchorDate(schedule, prepayment, start).toISOString().slice(0, 10)).toBe('2026-01-01');
  });
});

describe('assertPrepaymentDate', () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  const now = new Date(Date.UTC(2026, 0, 1));

  it('accepts a date on the lower bound', () => {
    expect(() => assertPrepaymentDate(start, start, now)).not.toThrow();
  });

  it('rejects a date before startDate', () => {
    expect(() => assertPrepaymentDate(new Date(Date.UTC(2025, 11, 31)), start, now)).toThrow(AppError);
  });

  it('accepts a date exactly on maxPrepaymentDate', () => {
    expect(() => assertPrepaymentDate(new Date(Date.UTC(2027, 0, 1)), start, now)).not.toThrow();
  });

  it('rejects a date beyond maxPrepaymentDate', () => {
    expect(() => assertPrepaymentDate(new Date(Date.UTC(2027, 0, 2)), start, now)).toThrow(AppError);
  });
});

describe('assertAmountWithinOutstanding', () => {
  it('accepts the exact outstanding + accrued amount', () => {
    expect(() => assertAmountWithinOutstanding(80_368.22, 80_000, 368.22)).not.toThrow();
  });

  it('accepts a one-kopeck rounding excess', () => {
    expect(() => assertAmountWithinOutstanding(80_368.23, 80_000, 368.22)).not.toThrow();
  });

  it('rejects an amount above the one-kopeck tolerance', () => {
    expect(() => assertAmountWithinOutstanding(80_368.24, 80_000, 368.22)).toThrow(AppError);
  });
});
