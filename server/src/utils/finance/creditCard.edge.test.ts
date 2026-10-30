import { describe, it, expect } from 'vitest';
import { buildCreditCardSchedule } from './creditCard';

const START = new Date(Date.UTC(2025, 0, 31));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('buildCreditCardSchedule boundary behavior', () => {
  it('без gracePeriodEnds возвращает пустой график (цикл заморозки)', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 120_000,
      annualRate: 29.9,
      startDate: START,
      termMonths: 12,
      paymentDay: 25,
      gracePeriodEnds: null,
      graceReplenishSum: 5_000,
      graceReplenishDay: 7,
    });
    expect(s).toHaveLength(0);
  });

  it('льгота закрывает всю сумму при одном пополнении', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 12_000,
      annualRate: 29.9,
      startDate: START,
      termMonths: 12,
      paymentDay: 25,
      gracePeriodEnds: new Date(Date.UTC(2025, 2, 31)),
      graceReplenishSum: 40_000,
      graceReplenishDay: 7,
    });
    expect(s.every((i) => i.interestPart === 0)).toBe(true);
    expect(sum(s.map((i) => i.principalPart))).toBe(12_000);
    expect(sum(s.map((i) => i.amount))).toBe(12_000);
    expect(s).toHaveLength(1);
  });

  it('льгота может завершиться раньше даты конца grace для небольшой суммы', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 5_000,
      annualRate: 29.9,
      startDate: START,
      termMonths: 2,
      paymentDay: 25,
      gracePeriodEnds: new Date(Date.UTC(2025, 2, 31)),
      graceReplenishSum: 10_000,
      graceReplenishDay: 7,
    });
    expect(s.every((i) => i.interestPart === 0)).toBe(true);
    expect(s).toHaveLength(1);
    expect(sum(s.map((i) => i.amount))).toBe(5_000);
  });

  it('после льготы остаётся аннуитет на остаток', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 100_000,
      annualRate: 29.9,
      startDate: START,
      termMonths: 12,
      paymentDay: 25,
      gracePeriodEnds: new Date(Date.UTC(2025, 1, 28)),
      graceReplenishSum: 5_000,
      graceReplenishDay: 7,
    });
    const grace = s.filter((i) => i.dueDate <= new Date(Date.UTC(2025, 1, 28)));
    const after = s.filter((i) => i.dueDate > new Date(Date.UTC(2025, 1, 28)));
    expect(grace.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(sum(s.map((i) => i.principalPart))).toBe(100_000);
    expect(after.some((i) => i.interestPart > 0)).toBe(true);
  });

  it('льготная дата inclusive: платёж с dueDate = graceEnd считается льготным', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 100_000,
      annualRate: 29.9,
      startDate: START,
      termMonths: 12,
      paymentDay: 25,
      gracePeriodEnds: new Date(Date.UTC(2025, 1, 7)),
      graceReplenishSum: 5_000,
      graceReplenishDay: 7,
    });
    const firstAnnity = s.find((i) => i.interestPart > 0);
    expect(s[0].dueDate.getUTCMonth()).toBe(1);
    expect(s[0].dueDate.getUTCDate()).toBe(7);
    expect(s[0].interestPart).toBe(0);
    // Current formula: residual annuity starts on Mar 7 (UTC month index 2).
    expect(firstAnnity?.dueDate.getUTCMonth()).toBe(2);
  });

  it('graceReplenishDay=1 и paymentDay=31 клампятся по короткому месяцу', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 50_000,
      annualRate: 24,
      startDate: new Date(Date.UTC(2024, 1, 29)),
      termMonths: 6,
      paymentDay: 31,
      gracePeriodEnds: new Date(Date.UTC(2024, 2, 31)),
      graceReplenishSum: 15_000,
      graceReplenishDay: 1,
    });
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].dueDate.getUTCDate()).toBe(1);
    expect(s[s.length - 1].dueDate.getUTCDate()).toBeLessThanOrEqual(31);
  });

  it('аннуитет после льготы имеет положительный платёж и сходится', () => {
    const s = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 100_000,
      annualRate: 36.5,
      startDate: new Date(Date.UTC(2025, 0, 15)),
      termMonths: 12,
      paymentDay: 15,
      gracePeriodEnds: new Date(Date.UTC(2025, 1, 28)),
      graceReplenishSum: 10_000,
      graceReplenishDay: 5,
    });
    const after = s.filter((i) => i.interestPart > 0);
    expect(after.every((i) => i.amount > 0)).toBe(true);
    const principal = sum(s.map((i) => i.principalPart));
    expect(Math.abs(principal - 100_000)).toBeLessThan(0.05);
  });
});

// monthsBetween boundary tests moved to date.edge.test.ts
