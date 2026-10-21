import { describe, expect, it } from 'vitest';
import { buildDueDates } from './date';
import { planPastPayments } from './pastPayments';
import { generateSchedule } from './schedule';

describe('planPastPayments', () => {
  it('кредит из прошлого: часть платежей уже оплачена, остаток уменьшен', () => {
    // Пример: оформлен 15.08.2024, срок 60 мес, ставка 19.8%, платёж ~36 000
    const startDate = new Date(Date.UTC(2024, 7, 15));
    const schedule = generateSchedule({
      type: 'ANNUITY',
      principal: 1_300_000,
      annualRate: 19.8,
      startDate,
      termMonths: 60,
      paymentDay: 15,
    });

    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));

    // С августа 2024 по октябрь 2026 должно пройти 26 платежей
    expect(plan.paidCount).toBe(26);
    expect(plan.paidTotal).toBeGreaterThan(0);
    // Тело долга вычтено: остаток строго меньше первоначального
    expect(plan.outstanding).toBeLessThan(1_300_000);
    expect(plan.outstanding).toBeGreaterThan(0);
    // Сумма проценты+тело в каждой строке равна полному платежу
    for (const item of schedule.slice(0, plan.paidCount)) {
      expect(item.principalPart + item.interestPart).toBeCloseTo(item.amount, 1);
    }
  });

  it('новый кредит: ничего не оплачено', () => {
    const startDate = new Date(Date.UTC(2026, 9, 1));
    const schedule = generateSchedule({
      type: 'ANNUITY',
      principal: 300_000,
      annualRate: 15,
      startDate,
      termMonths: 12,
      paymentDay: 1,
    });

    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));

    expect(plan.paidCount).toBe(0);
    expect(plan.paidTotal).toBe(0);
    expect(plan.outstanding).toBeCloseTo(300_000, 0);
  });

  it('не закрывает кредит целиком, даже если все даты в прошлом', () => {
    const startDate = new Date(Date.UTC(2023, 0, 1));
    const schedule = generateSchedule({
      type: 'ANNUITY',
      principal: 100_000,
      annualRate: 20,
      startDate,
      termMonths: 6,
      paymentDay: 1,
    });

    // «Сегодня» намного позже последнего платежа
    const plan = planPastPayments(schedule, new Date(Date.UTC(2030, 0, 1)));

    expect(plan.paidCount).toBe(5); // последний оставлен неоплаченным
    expect(plan.outstanding).toBeGreaterThan(0);
  });

  it('дифференцированный график считается так же', () => {
    const startDate = new Date(Date.UTC(2025, 0, 10));
    const schedule = generateSchedule({
      type: 'DIFFERENTIAL',
      principal: 600_000,
      annualRate: 18,
      startDate,
      termMonths: 24,
      paymentDay: 10,
    });

    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));

    expect(plan.paidCount).toBeGreaterThan(0);
    const principalTotal = schedule.reduce((sum, i) => sum + i.principalPart, 0);
    expect(plan.outstanding).toBeCloseTo(principalTotal - plan.paidPrincipal, 1);
  });

  it('даты платежей строятся от startDate с учётом дня платежа', () => {
    const dates = buildDueDates(new Date(Date.UTC(2024, 7, 15)), 3, 15);
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2024-09-15',
      '2024-10-15',
      '2024-11-15',
    ]);
  });
});
