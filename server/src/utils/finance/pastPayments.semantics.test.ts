import { describe, it, expect } from 'vitest';
import type { ScheduleItem } from './types';
import { planPastPayments } from './pastPayments';

function mk(items: Array<{ due: Date; amount: number; principal: number; interest: number }>): ScheduleItem[] {
  return items.map((x) => ({
    dueDate: x.due,
    amount: x.amount,
    principalPart: x.principal,
    interestPart: x.interest,
  }));
}

describe('planPastPayments semantics Step1', () => {
  it('один просроченный платёж автоматически не считается оплаченным', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 8, 1)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));
    expect(plan.paidCount).toBe(0);
    expect(plan.outstanding).toBe(900);
  });

  it('один будущий платёж не считается оплаченным', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 10, 1)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));
    expect(plan.paidCount).toBe(0);
    expect(plan.outstanding).toBe(900);
  });

  it('один просроченный платёж с явным assumeAllDuePaid считается оплаченным', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 8, 1)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)), {
      assumeAllDuePaid: true,
    });
    expect(plan.paidCount).toBe(1);
    expect(plan.outstanding).toBe(0);
    expect(plan.paidTotal).toBe(1000);
  });

  it('multi: прошедший первый платёж считается оплаченным, будущий остаётся', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 8, 1)), amount: 1000, principal: 900, interest: 100 },
      { due: new Date(Date.UTC(2026, 10, 1)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));
    expect(plan.paidCount).toBe(1);
    expect(plan.outstanding).toBe(900);
  });

  it('multi: все даты в прошлом не закрывают кредит автоматически', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 7, 1)), amount: 1000, principal: 900, interest: 100 },
      { due: new Date(Date.UTC(2026, 8, 1)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));
    expect(plan.paidCount).toBe(1);
    expect(plan.outstanding).toBe(900);
  });

  it('multi: assumeAllDuePaid закрывает все прошедшие платежи явно', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 7, 1)), amount: 1000, principal: 900, interest: 100 },
      { due: new Date(Date.UTC(2026, 8, 1)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)), {
      assumeAllDuePaid: true,
    });
    expect(plan.paidCount).toBe(2);
    expect(plan.outstanding).toBe(0);
  });

  it('граница: платёж с датой today считается прошедшим', () => {
    const schedule = mk([
      { due: new Date(Date.UTC(2026, 9, 21)), amount: 1000, principal: 900, interest: 100 },
      { due: new Date(Date.UTC(2026, 10, 21)), amount: 1000, principal: 900, interest: 100 },
    ]);
    const plan = planPastPayments(schedule, new Date(Date.UTC(2026, 9, 21)));
    expect(plan.paidCount).toBe(1);
  });

  it('пустой график безопасен', () => {
    const plan = planPastPayments([], new Date(Date.UTC(2026, 9, 21)));
    expect(plan.paidCount).toBe(0);
    expect(plan.totalCount).toBe(0);
    expect(plan.outstanding).toBe(0);
    expect(plan.paidTotal).toBe(0);
  });
});
