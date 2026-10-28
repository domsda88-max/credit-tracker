export interface AcceleratorDebt {
  id: string;
  name: string;
  annualRate: number;
  balance: number;
  minPayment: number;
}

export interface AcceleratorInput {
  extraPerMonth: number;
  baselineMonths: number;
  debts: AcceleratorDebt[];
}

export interface AcceleratorResult {
  baselineMonths: number;
  acceleratedMonths: number;
  savedMonths: number;
  targetName: string;
  extraPerMonth: number;
}

const MAX_DAYS = 600 * 30;

function simulate(debts: AcceleratorDebt[], extraPerMonth: number): { months: number; targetName: string } {
  const d = debts.map((x) => ({ ...x }));
  let days = 0;
  let targetName = d[0]?.name ?? '';
  const dailyExtra = extraPerMonth / 30;
  while (d.some((x) => x.balance > 0.01) && days < MAX_DAYS) {
    days += 1;
    const active = d.filter((x) => x.balance > 0.01);
    if (active.length === 0) break;
    const target = active.reduce((a, b) => (a.annualRate > b.annualRate ? a : b));
    targetName = target.name;
    for (const debt of d) {
      if (debt.balance <= 0.01) continue;
      const dailyRate = debt.annualRate / 100 / 365;
      const interest = debt.balance * dailyRate;
      let payment = debt.minPayment / 30;
      if (debt.id === target.id) payment += dailyExtra;
      const maxPayment = debt.balance + interest;
      payment = Math.min(payment, maxPayment);
      const toPrincipal = payment - interest;
      debt.balance = Math.max(0, debt.balance - toPrincipal);
    }
  }
  return { months: days / 30, targetName };
}

export function simulateAccelerator(input: AcceleratorInput): AcceleratorResult | null {
  const debts = input.debts.filter((d) => d.balance > 0);
  if (debts.length === 0 || input.extraPerMonth <= 0) return null;
  if (!Number.isFinite(input.baselineMonths) || input.baselineMonths <= 0) return null;

  const target = [...debts].sort((a, b) => b.annualRate - a.annualRate)[0];

  const r = simulate(debts, input.extraPerMonth);
  const acceleratedMonths = r.months;

  return {
    baselineMonths: input.baselineMonths,
    acceleratedMonths,
    savedMonths: Math.max(0, input.baselineMonths - acceleratedMonths),
    targetName: target.name,
    extraPerMonth: input.extraPerMonth,
  };
}