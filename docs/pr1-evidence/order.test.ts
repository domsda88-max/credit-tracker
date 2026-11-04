import { describe, expect, it } from 'vitest';
import { simulateAccelerator } from '../src/utils/finance/accelerator';

describe('Проверка порядка targetIndex', () => {
  it('когда самый дорогой закрыт, цель — следующий по ставке (не первый незакрытый в массиве)', () => {
    // order после сортировки: A(50%), B(30%), C(10%)
    const res = simulateAccelerator({
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: 'A', name: 'A 50%', annualRate: 50, balance: 30_000, minPayment: 1_000 },
        { id: 'B', name: 'B 30%', annualRate: 30, balance: 60_000, minPayment: 1_000 },
        { id: 'C', name: 'C 10%', annualRate: 10, balance: 90_000, minPayment: 1_000 },
      ],
    });
    console.log('avalanche:', JSON.stringify(res));
    expect(res!.targetName).toBe('A 50%');
  });

  it('одинаковые ставки — стабилен ли порядок? (A и B по 30%, разные балансы)', () => {
    const res = simulateAccelerator({
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: 'A', name: 'A 30%', annualRate: 30, balance: 100_000, minPayment: 5_000 },
        { id: 'B', name: 'B 30%', annualRate: 30, balance: 20_000, minPayment: 1_000 },
      ],
    });
    console.log('tie:', JSON.stringify(res));
  });
});
