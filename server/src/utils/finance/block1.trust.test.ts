import { describe, it, expect } from 'vitest';
import { effectiveAnnualRate } from './effectiveRate';
import { paidPercent, crossedMilestone, milestoneMessage } from './milestones';
import { round2 } from './round';
import { buildMicroloanSchedule } from './microloan';
import { annuityPayment, buildAnnuitySchedule } from './annuity';
import { buildDifferentialSchedule } from './differential';

describe('Block1 — effectiveRate', () => {
  it('замороженная карта: 0%', () => expect(effectiveAnnualRate(24, true)).toBe(0));
  it('не замороженная: реальная ставка', () => expect(effectiveAnnualRate(24, false)).toBe(24));
  it('ставка 0 остаётся 0 при разморозке', () => expect(effectiveAnnualRate(0, false)).toBe(0));
});

describe('Block1 — milestones', () => {
  it('paidPercent при principal=0 → 100', () => expect(paidPercent(0, 0)).toBe(100));
  it('paidPercent корректно считает долю', () => expect(paidPercent(1000, 600)).toBe(40));
  it('paidPercent не уходит в минус при outstanding>principal', () => expect(paidPercent(1000, 2000)).toBe(0));
  it('crossedMilestone пересечение 50', () => expect(crossedMilestone(49, 51)).toBe(50));
  it('crossedMilestone без пересечения', () => expect(crossedMilestone(40, 45)).toBeNull());
  it('milestoneMessage для 100', () => expect(milestoneMessage('X', 100)).toContain('полностью'));
});

describe('Block1 — round', () => {
  it('round2 округляет до 2 знаков', () => expect(round2(1.2345)).toBe(1.23));
  it('round2 отрицательные (JS round half toward +inf)', () => expect(round2(-2.345)).toBe(-2.34));
});

describe('Block1 — microloan days', () => {
  it('10000 ₽ на 30 дней при 0.1%/день ~ 300₽ процентов', () => {
    const s = buildMicroloanSchedule({ principal: 10000, annualRate: 36.5, startDate: new Date('2026-01-01'), termDays: 30 });
    expect(s).toHaveLength(1);
    expect(s[0].principalPart).toBe(10000);
    expect(s[0].interestPart).toBeGreaterThan(0);
    expect(s[0].amount).toBeGreaterThan(10000);
  });
  it('бросает при termDays=0', () => {
    expect(() => buildMicroloanSchedule({ principal: 1000, annualRate: 10, startDate: new Date(), termDays: 0 })).toThrow();
  });
  it('бросает при termDays>365', () => {
    expect(() => buildMicroloanSchedule({ principal: 1000, annualRate: 10, startDate: new Date(), termDays: 400 })).toThrow();
  });
});

describe('Block1 — annuity convergence', () => {
  it('сумма основного долга = principal', () => {
    const items = buildAnnuitySchedule(100000, 12, 12, Array.from({ length: 12 }, (_, i) => new Date(2026, i + 1, 1)));
    const total = items.reduce((s, x) => s + x.principalPart, 0);
    expect(Math.abs(total - 100000)).toBeLessThan(0.05);
  });
  it('annuityPayment при 0% делит поровну', () => {
    expect(annuityPayment(12000, 0, 12)).toBe(1000);
  });
});

describe('Block1 — differential convergence', () => {
  it('differential основной долг сходится', () => {
    const items = buildDifferentialSchedule(120000, 12, 12, Array.from({ length: 12 }, (_, i) => new Date(2026, i + 1, 1)));
    const total = items.reduce((s, x) => s + x.principalPart, 0);
    expect(Math.abs(total - 120000)).toBeLessThan(0.05);
  });
});
