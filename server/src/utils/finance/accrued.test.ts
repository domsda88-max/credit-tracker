import { describe, expect, it } from 'vitest';
import { accruedInterestForPeriod } from './accrued';

const d = (s: string) => new Date(s);

describe('accruedInterestForPeriod', () => {
  it('проценты за период между последней оплатой и досрочкой', () => {
    const r = accruedInterestForPeriod({
      outstanding: 225300,
      annualRate: 24.9,
      anchorDate: d('2026-08-20T00:00:00Z'),
      prepaymentDate: d('2026-09-10T00:00:00Z'),
    });
    expect(r.days).toBe(21);
    expect(r.accruedInterest).toBeCloseTo(3227.65, 1);
  });

  it('регресс: anchor=startDate даёт сотни тысяч (признак старого бага)', () => {
    const r = accruedInterestForPeriod({
      outstanding: 225300,
      annualRate: 24.9,
      anchorDate: d('2024-08-20T00:00:00Z'),
      prepaymentDate: d('2026-09-10T00:00:00Z'),
    });
    expect(r.accruedInterest).toBeGreaterThan(100000);
  });

  it('дата раньше anchor → 0 дней и 0 процентов', () => {
    const r = accruedInterestForPeriod({
      outstanding: 100000,
      annualRate: 20,
      anchorDate: d('2026-09-10T00:00:00Z'),
      prepaymentDate: d('2026-09-01T00:00:00Z'),
    });
    expect(r.days).toBe(0);
    expect(r.accruedInterest).toBe(0);
  });

  it('NaN/Infinity безопасны', () => {
    const r = accruedInterestForPeriod({
      outstanding: Number.NaN,
      annualRate: 20,
      anchorDate: d('2026-09-01T00:00:00Z'),
      prepaymentDate: d('2026-09-10T00:00:00Z'),
    });
    expect(r.accruedInterest).toBe(0);
  });
});
