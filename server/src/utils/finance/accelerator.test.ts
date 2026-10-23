import { describe, expect, it } from 'vitest';
import { simulateAccelerator } from './accelerator';
import { buildCreditCardSchedule } from './creditCard';
import { buildDueDates } from './date';

describe('Карта в цикле заморозки', () => {
  it('не строит график минимальных платежей без конца льготного периода', () => {
    const schedule = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 40_000,
      annualRate: 0,
      startDate: new Date(Date.UTC(2025, 10, 21)),
      termMonths: 12,
      paymentDay: 28,
      gracePeriodEnds: null,
      graceReplenishSum: 40_000,
      graceReplenishDay: 28,
    });

    // У замороженной карты нет минимального платежа и срока —
    // платится только сумма обновления периода (её контролирует цикл заморозки).
    expect(schedule).toHaveLength(0);
  });

  it('после конца льготного периода строит аннуитет на остаток', () => {
    const schedule = buildCreditCardSchedule({
      type: 'MIN_PAYMENT',
      principal: 120_000,
      annualRate: 36,
      startDate: new Date(Date.UTC(2025, 0, 1)),
      termMonths: 12,
      paymentDay: 20,
      gracePeriodEnds: new Date(Date.UTC(2025, 5, 1)),
      graceReplenishSum: 20_000,
      graceReplenishDay: 20,
    });

    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[0].interestPart).toBe(0); // льготная фаза
  });
});

describe('Прогноз ускоренного погашения', () => {
  const debts = [
    { id: '1', name: 'Дорогая карта', annualRate: 40, balance: 100_000, minPayment: 5_000 },
    { id: '2', name: 'Ипотека', annualRate: 19.8, balance: 2_000_000, minPayment: 35_000 },
  ];

  it('показывает, что доп. взнос сокращает срок', () => {
    const result = simulateAccelerator({ extraPerMonth: 10_000, baselineMonths: 240, debts });
    expect(result).not.toBeNull();
    expect(result!.acceleratedMonths).toBeLessThan(result!.baselineMonths);
    expect(result!.savedMonths).toBe(result!.baselineMonths - result!.acceleratedMonths);
  });

  it('цель — самый дорогой долг', () => {
    const result = simulateAccelerator({ extraPerMonth: 10_000, baselineMonths: 240, debts });
    expect(result!.targetName).toBe('Дорогая карта');
  });

  it('замороженная карта (0 ₽/мес, 0%) не мешает расчёту', () => {
    const result = simulateAccelerator({
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        ...debts,
        { id: '3', name: 'Замороженная', annualRate: 0, balance: 45_000, minPayment: 0 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.acceleratedMonths).toBeGreaterThan(0);
  });

  it('без доп. взноса прогноза нет', () => {
    expect(simulateAccelerator({ extraPerMonth: 0, baselineMonths: 240, debts })).toBeNull();
  });
});
