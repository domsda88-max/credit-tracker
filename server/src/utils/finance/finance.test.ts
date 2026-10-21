import { describe, expect, it } from 'vitest';
import { buildAnnuitySchedule, annuityPayment } from './annuity';
import { buildDifferentialSchedule } from './differential';
import { buildCreditCardSchedule } from './creditCard';
import { rebuildSchedule } from './earlyRepayment';
import { buildDueDates } from './date';
import { crossedMilestone, paidPercent } from './milestones';
import { round2 } from './round';

const START = new Date(Date.UTC(2025, 0, 15)); // 15.01.2025

function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

describe('Аннуитет', () => {
  const principal = 500_000;
  const rate = 19.5;
  const term = 36;
  const schedule = buildAnnuitySchedule(principal, rate, term, buildDueDates(START, term, 20));

  it('строит ровно term платежей', () => {
    expect(schedule).toHaveLength(term);
  });

  it('сумма основного долга = сумма кредита', () => {
    expect(sum(schedule.map((i) => i.principalPart))).toBe(principal);
  });

  it('сумма процентов = сумма платежей − тело кредита', () => {
    const totalPayments = sum(schedule.map((i) => i.amount));
    const totalInterest = sum(schedule.map((i) => i.interestPart));
    expect(totalPayments).toBe(round2(principal + totalInterest));
  });

  it('учитывает день платежа и убывающий остаток процентов', () => {
    expect(schedule[0].dueDate.toISOString().slice(0, 10)).toBe('2025-02-20');
    expect(schedule[0].interestPart).toBeGreaterThan(schedule[term - 1].interestPart);
  });
});

describe('Дифференцированный', () => {
  const principal = 300_000;
  const term = 24;
  const schedule = buildDifferentialSchedule(principal, 15, term, buildDueDates(START, term, 10));

  it('основной долг делится полностью', () => {
    expect(sum(schedule.map((i) => i.principalPart))).toBe(principal);
  });

  it('платежи убывают', () => {
    expect(schedule[0].amount).toBeGreaterThan(schedule[term - 1].amount);
  });
});

describe('Кредитка с льготным периодом', () => {
  const schedule = buildCreditCardSchedule({
    type: 'MIN_PAYMENT',
    principal: 120_000,
    annualRate: 29.9,
    startDate: START,
    termMonths: 12,
    paymentDay: 25,
    gracePeriodEnds: new Date(Date.UTC(2025, 5, 30)), // до 30.06.2025
    graceReplenishSum: 5_000, // пополнение для продления периода
    graceReplenishDay: 7,
  });

  it('в льготный период проценты не начисляются', () => {
    const graceItems = schedule.filter((i) => i.dueDate <= new Date(Date.UTC(2025, 5, 30)));
    expect(graceItems.length).toBeGreaterThan(0);
    expect(graceItems.every((i) => i.interestPart === 0)).toBe(true);
  });

  it('сумма тела долга сходится с суммой кредита', () => {
    expect(sum(schedule.map((i) => i.principalPart))).toBe(120_000);
  });

  it('после льготного периода появляются проценты', () => {
    expect(schedule.some((i) => i.interestPart > 0)).toBe(true);
  });
});

describe('Досрочное погашение', () => {
  it('REDUCE_PAYMENT уменьшает платёж', () => {
    const annuity = annuityPayment(500_000, 19.5, 36);
    const rebuilt = rebuildSchedule({
      outstanding: 500_000 - 100_000,
      annualRate: 19.5,
      paymentType: 'ANNUITY',
      mode: 'REDUCE_PAYMENT',
      remainingTermMonths: 30,
      nextDueDate: new Date(Date.UTC(2025, 5, 20)),
      previousPayment: annuity,
    });

    expect(rebuilt).toHaveLength(30);
    expect(rebuilt[0].amount).toBeLessThan(annuity);
    expect(sum(rebuilt.map((i) => i.principalPart))).toBe(400_000);
  });

  it('REDUCE_TERM сокращает срок', () => {
    const annuity = annuityPayment(500_000, 19.5, 36);
    const rebuilt = rebuildSchedule({
      outstanding: 400_000,
      annualRate: 19.5,
      paymentType: 'ANNUITY',
      mode: 'REDUCE_TERM',
      remainingTermMonths: 30,
      nextDueDate: new Date(Date.UTC(2025, 5, 20)),
      previousPayment: annuity,
    });

    expect(rebuilt.length).toBeLessThan(30);
    // Платёж сохраняется (расхождение — только от округления срока до целых месяцев).
    expect(Math.abs(rebuilt[0].amount - annuity) / annuity).toBeLessThan(0.01);
  });

  it('нулевой остаток → пустой график', () => {
    expect(
      rebuildSchedule({
        outstanding: 0,
        annualRate: 10,
        paymentType: 'ANNUITY',
        mode: 'REDUCE_PAYMENT',
        remainingTermMonths: 10,
        nextDueDate: START,
      }),
    ).toHaveLength(0);
  });
});

describe('Мотивационные отметки', () => {
  it('процент погашения считается по телу долга', () => {
    // Долг 100 000, остаток 50 000 → погашено 50%
    expect(paidPercent(100_000, 50_000)).toBe(50);
    // Проценты банку долг не уменьшают: выплатили 80 000, но долг упал лишь на 30 000
    expect(paidPercent(100_000, 70_000)).toBe(30);
    // Полностью закрыт
    expect(paidPercent(100_000, 0)).toBe(100);
  });

  it('пересечение отметки 50% определяется', () => {
    expect(crossedMilestone(48, 52)).toBe(50);
  });

  it('без пересечения отметки — null', () => {
    expect(crossedMilestone(51, 60)).toBeNull();
  });
});
