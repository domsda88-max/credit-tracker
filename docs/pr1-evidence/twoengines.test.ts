import { describe, expect, it } from 'vitest';
import { simulateAccelerator as serverSim } from '../src/utils/finance/accelerator';
import { simulateAccelerator as clientSim } from '../../client/src/utils/finance/accelerator';

describe('Два движка: server vs client', () => {
  const debts = [
    { id: '1', name: 'Дорогая карта', annualRate: 40, balance: 100_000, minPayment: 5_000 },
    { id: '2', name: 'Ипотека', annualRate: 19.8, balance: 2_000_000, minPayment: 35_000 },
  ];
  it('сравниваем результаты при одинаковых входах', () => {
    const s = serverSim({ extraPerMonth: 10_000, baselineMonths: 240, debts });
    const c = clientSim({ extraPerMonth: 10_000, baselineMonths: 240, debts });
    console.log('SERVER:', JSON.stringify(s));
    console.log('CLIENT:', JSON.stringify(c));
    if (s && c) {
      console.log('DELTA months:', (s.acceleratedMonths - c.acceleratedMonths).toFixed(2),
        '=', Math.abs(s.acceleratedMonths - c.acceleratedMonths).toFixed(1), 'мес');
    }
    expect(s).not.toBeNull();
    expect(c).not.toBeNull();
  });

  it('разные targetName?', () => {
    const s = serverSim({ extraPerMonth: 10_000, baselineMonths: 240, debts });
    const c = clientSim({ extraPerMonth: 10_000, baselineMonths: 240, debts });
    console.log('target S:', s?.targetName, '| target C:', c?.targetName);
  });

  it('замороженная карта с высоким балансом и ставкой 0 — как распределяется?', () => {
    const d = [
      { id: '1', name: 'Кредит 30%', annualRate: 30, balance: 300_000, minPayment: 15_000 },
      { id: '2', name: 'Замороженная', annualRate: 0, balance: 45_000, minPayment: 0 },
    ];
    const s = serverSim({ extraPerMonth: 10_000, baselineMonths: 120, debts: d });
    const c = clientSim({ extraPerMonth: 10_000, baselineMonths: 120, debts: d });
    console.log('frozen SERVER:', JSON.stringify(s));
    console.log('frozen CLIENT:', JSON.stringify(c));
  });
});
