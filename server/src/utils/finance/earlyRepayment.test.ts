import { describe, expect, it } from 'vitest';
import { applyHistoricalPrepayments } from './earlyRepayment';

describe('applyHistoricalPrepayments', () => {
  it('применяет одну досрочку и пересчитывает график', () => {
    const result = applyHistoricalPrepayments(
      1000000, 20, 'ANNUITY' as any,
      new Date('2024-01-01'), 60, 15,
      [{ amount: 100000, date: new Date('2024-06-15') }],
    );
    expect(result.outstanding).toBeLessThan(1000000);
    expect(result.schedule.length).toBeGreaterThan(0);
  });

  it('применяет несколько досрочек последовательно', () => {
    const result = applyHistoricalPrepayments(
      1000000, 20, 'ANNUITY' as any,
      new Date('2024-01-01'), 60, 15,
      [
        { amount: 50000, date: new Date('2024-03-15') },
        { amount: 100000, date: new Date('2024-09-15') },
      ],
    );
    expect(result.outstanding).toBeLessThan(991000);
  });

  it('без досрочек возвращает исходный график', () => {
    const result = applyHistoricalPrepayments(
      1000000, 20, 'ANNUITY' as any,
      new Date('2024-01-01'), 60, 15,
      [],
    );
    expect(result.outstanding).toBe(1000000);
    expect(result.schedule.length).toBe(60);
  });
});