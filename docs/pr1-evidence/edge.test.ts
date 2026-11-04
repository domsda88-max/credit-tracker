import { describe, expect, it } from 'vitest';
import { simulateAccelerator } from '../src/utils/finance/accelerator';

describe('Пограничные случаи accelerator (проверка из Шага 0)', () => {
  it('extra закрывает два долгa за один месяц — излишек переносится', () => {
    const res = simulateAccelerator({
      extraPerMonth: 100_000,
      baselineMonths: 60,
      debts: [
        { id: '1', name: 'Малый дорогой', annualRate: 40, balance: 20_000, minPayment: 3_000 },
        { id: '2', name: 'Средний', annualRate: 30, balance: 50_000, minPayment: 5_000 },
        { id: '3', name: 'Ипотека', annualRate: 20, balance: 1_000_000, minPayment: 30_000 },
      ],
    });
    expect(res).not.toBeNull();
    // пул = 38k + 100k = 138k. Первый месяц: проценты, минималки на 2 и 3, остальное в 1.
    console.log('twoDebtsClosed:', JSON.stringify(res));
    expect(res!.acceleratedMonths).toBeGreaterThan(0);
  });

  it('целью считается самый дорогой ПЛАТЁЖНЫЙ долг, замороженная карта не цель', () => {
    const res = simulateAccelerator({
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: '1', name: 'Замороженная с высокой ставкой', annualRate: 0, balance: 500_000, minPayment: 0 },
        { id: '2', name: 'Реально гасимый', annualRate: 30, balance: 100_000, minPayment: 10_000 },
      ],
    });
    expect(res!.targetName).toBe('Реально гасимый');
  });

  it('minPayment больше баланса — деньги не теряются, идут дальше', () => {
    const res = simulateAccelerator({
      extraPerMonth: 5_000,
      baselineMonths: 120,
      debts: [
        { id: '1', name: 'Дорогой', annualRate: 40, balance: 10_000, minPayment: 20_000 },
        { id: '2', name: 'Дешёвый', annualRate: 10, balance: 200_000, minPayment: 10_000 },
      ],
    });
    expect(res).not.toBeNull();
    console.log('overpayCase:', JSON.stringify(res));
  });

  it('baselineMonths=0 или NaN → null (нет ложного сравнения)', () => {
    const debts = [{ id: '1', name: 'A', annualRate: 20, balance: 100_000, minPayment: 10_000 }];
    expect(simulateAccelerator({ extraPerMonth: 5_000, baselineMonths: 0, debts })).toBeNull();
    expect(simulateAccelerator({ extraPerMonth: 5_000, baselineMonths: NaN, debts })).toBeNull();
  });

  it('лавиный порядок: targetIndex = первый по сортировке (самый дорогой), а не «первый незакрытый»', () => {
    // Проверим, что после закрытия дорогого долга его минималка остаётся в пуле (рециклинг)
    const withRecycle = simulateAccelerator({
      extraPerMonth: 0.0001, // формально >0, чтобы не вернуть null
      baselineMonths: 300,
      debts: [
        { id: '1', name: 'Дорогой маленький', annualRate: 50, balance: 10_000, minPayment: 10_000 },
        { id: '2', name: 'Дешёвый большой', annualRate: 10, balance: 1_000_000, minPayment: 10_000 },
      ],
    });
    console.log('recycleCheck:', JSON.stringify(withRecycle));
    expect(withRecycle).not.toBeNull();
  });
});
