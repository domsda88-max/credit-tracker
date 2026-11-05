import { round2 } from './round';

export interface AcceleratorDebt {
  id: string;
  name: string;
  /** Annual rate, %. */
  annualRate: number;
  /** Outstanding principal, RUB. */
  balance: number;
  /**
   * How much per month actually goes to reducing this debt, RUB.
   * For cards in a freeze cycle = 0: the period renewal amount only extends
   * the grace period and does NOT reduce the principal.
   */
  minPayment: number;
}

export interface AcceleratorInput {
  /** Extra payment per month, RUB. */
  extraPerMonth: number;
  /** Months until debt-free at the current schedule (from the summary). */
  baselineMonths: number;
  debts: AcceleratorDebt[];
}

export interface AcceleratorResult {
  /** Months until debt-free at the current pace. */
  baselineMonths: number;
  /** Months until debt-free with the extra payment (avalanche: most expensive first). */
  acceleratedMonths: number;
  /** Months saved. */
  savedMonths: number;
  /** Name of the target debt (the most expensive one that is actually repaid). */
  targetName: string;
  /** Extra payment per month. */
  extraPerMonth: number;
}

/** Safety valve: 100 years — beyond that we treat it as "never". */
const MAX_MONTHS = 1200;

/** Avalanche order: highest rate first; equal rates — lower id first (stable tie-break). */
function byRateThenId(a: AcceleratorDebt, b: AcceleratorDebt): number {
  if (b.annualRate !== a.annualRate) return b.annualRate - a.annualRate;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Avalanche repayment simulation.
 *
 * Every month all debts receive their mandatory payments, and the remaining
 * money (extra payment + payments of already closed debts) goes to the most
 * expensive debt by rate. When it is closed, the money moves to the next one.
 *
 * Cards in a freeze cycle do not decrease on their own (0 RUB per month), so
 * they close last — when money is freed from the other debts. This is the
 * honest picture: "freeze" saves interest but does not reduce the principal.
 */
export function simulateAccelerator(input: AcceleratorInput): AcceleratorResult | null {
  const debts = input.debts.filter((d) => d.balance > 0);
  if (debts.length === 0 || input.extraPerMonth <= 0) return null;
  if (!Number.isFinite(input.baselineMonths) || input.baselineMonths <= 0) return null;

  // Target — the most expensive debt that is actually repaid by payments.
  const payable = debts.filter((d) => d.minPayment > 0);
  const target = [...(payable.length > 0 ? payable : debts)].sort(byRateThenId)[0];

  // Avalanche order: expensive first, free (frozen) last.
  const order = [...debts].sort(byRateThenId);
  const balances = order.map((d) => d.balance);
  const rates = order.map((d) => d.annualRate);
  const mins = order.map((d) => d.minPayment);

  // Monthly pool = all mandatory payments + extra payment.
  const pool = round2(debts.reduce((acc, d) => acc + d.minPayment, 0) + input.extraPerMonth);

  let months = 0;
  let finalAvailable = 0;
  while (balances.some((b) => b > 0.01) && months < MAX_MONTHS) {
    months += 1;
    let available = pool;

    // 1) Monthly interest (frozen cards have rate 0 in the calculation).
    for (let k = 0; k < balances.length; k++) {
      if (balances[k] > 0.01) {
        balances[k] = round2(balances[k] * (1 + rates[k] / 100 / 12));
      }
    }

    const targetIndex = balances.findIndex((b) => b > 0.01);

    // 2) Mandatory payments on every debt except the target.
    for (let k = 0; k < balances.length; k++) {
      if (k === targetIndex || balances[k] <= 0.01) continue;
      const pay = Math.min(mins[k], balances[k], available);
      if (pay <= 0) continue;
      balances[k] = round2(balances[k] - pay);
      available = round2(available - pay);
      if (available <= 0.01) break;
    }

    // 3) The remainder goes to the most expensive open debt.
    //    `available` MUST be decremented here: otherwise finalAvailable == pool
    //    when the goal closes and acceleratedMonths is underreported by ~1
    //    month. See cycle audit in docs/deploy/2026-11-05-pr2-pr1.md.
    if (targetIndex !== -1 && available > 0.01) {
      const pay = Math.min(available, balances[targetIndex]);
      balances[targetIndex] = round2(balances[targetIndex] - pay);
      available = round2(available - pay);
    }
    finalAvailable = available;
  }

  if (months >= MAX_MONTHS) return null;

  const exactMonths = pool > 0 ? Math.max(0, months - finalAvailable / pool) : months;
  return {
    baselineMonths: input.baselineMonths,
    acceleratedMonths: exactMonths,
    savedMonths: Math.max(0, input.baselineMonths - exactMonths),
    targetName: target.name,
    extraPerMonth: round2(input.extraPerMonth),
  };
}
