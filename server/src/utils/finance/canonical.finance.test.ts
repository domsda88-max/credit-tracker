import { describe, expect, it } from 'vitest';

import { annuityPayment, buildAnnuitySchedule } from './annuity';
import { buildDifferentialSchedule } from './differential';
import { buildMicroloanSchedule } from './microloan';
import { round2 } from './round';

const START = new Date(Date.UTC(2025, 0, 15));

function makeDueDates(n: number, day: number) {
  const arr: Date[] = [];
  const first = new Date(Date.UTC(2025, 1, day));
  for (let i = 0; i < n; i++) {
    const d = new Date(first);
    d.setUTCMonth(first.getUTCMonth() + i);
    arr.push(d);
  }
  return arr;
}

describe('Canonical 3.1 annuity 300000 24% 24m', () => {
  const sched = buildAnnuitySchedule(300000, 24, 24, makeDueDates(24, 20));
  it('payment', () => expect(annuityPayment(300000, 24, 24)).toBe(15861.33));
  it('first interest 6000', () => expect(sched[0].interestPart).toBe(6000));
  it('principal sum', () => expect(round2(sched.reduce((a, s) => a + s.principalPart, 0))).toBe(300000));
});

describe('Canonical 3.2 differential 120000 12% 12m', () => {
  const sched = buildDifferentialSchedule(120000, 12, 12, makeDueDates(12, 10));
  it('payment1 11200', () => expect(sched[0].amount).toBe(11200));
  it('payment2 11100', () => expect(sched[1].amount).toBe(11100));
});

describe('Canonical 3.4 MFQ balloon', () => {
  const sched = buildMicroloanSchedule({ principal: 30000, annualRate: 289, startDate: new Date(Date.UTC(2025, 0, 1)), termDays: 30 });
  it('single item', () => expect(sched).toHaveLength(1));
  it('total 37126.03', () => expect(sched[0].amount).toBe(37126.03));
});
