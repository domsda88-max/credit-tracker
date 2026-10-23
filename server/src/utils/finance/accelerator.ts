import { round2 } from './round';

export interface AcceleratorDebt {
  id: string;
  name: string;
  /** Ставка, % годовых. */
  annualRate: number;
  /** Остаток долга, ₽. */
  balance: number;
  /**
   * Сколько в месяц реально уходит на уменьшение этого долга, ₽.
   * Для карт в цикле заморозки = 0: сумма обновления периода лишь продлевает
   * льготный период и НЕ уменьшает тело долга.
   */
  minPayment: number;
}

export interface AcceleratorInput {
  /** Сумма дополнительного взноса в месяц, ₽. */
  extraPerMonth: number;
  /** Месяцев до свободы при текущем графике платежей (из сводки). */
  baselineMonths: number;
  debts: AcceleratorDebt[];
}

export interface AcceleratorResult {
  /** Месяцев до освобождения при текущем темпе. */
  baselineMonths: number;
  /** Месяцев до освобождения с дополнительным взносом (лавина: сначала дорогой долг). */
  acceleratedMonths: number;
  /** Сколько месяцев сэкономлено. */
  savedMonths: number;
  /** Название кредита-цели (самый дорогой из тех, что реально гасятся). */
  targetName: string;
  /** Сумма дополнительного взноса в месяц. */
  extraPerMonth: number;
}

/** Предохранитель: 100 лет — дальше считаем «никогда». */
const MAX_MONTHS = 1200;

/**
 * Симуляция «лавинного» метода погашения.
 *
 * Каждый месяц: все долги получают свои обязательные платежи, остаток денег
 * (дополнительный взнос + платежи уже закрытых долгов) идёт в самый дорогой
 * по ставке долг. Когда он закрыт — деньги перекидываются на следующий.
 *
 * Карты в цикле заморозки сами по себе не уменьшаются (0 ₽ в месяц), поэтому
 * закрываются последними — когда освободятся деньги от остальных долгов.
 * Это честная картина: «заморозка» бережёт проценты, но не гасит тело.
 */
export function simulateAccelerator(input: AcceleratorInput): AcceleratorResult | null {
  const debts = input.debts.filter((d) => d.balance > 0);
  if (debts.length === 0 || input.extraPerMonth <= 0) return null;
  if (!Number.isFinite(input.baselineMonths) || input.baselineMonths <= 0) return null;

  // Цель — самый дорогой долг, который реально гасится платежами.
  const payable = debts.filter((d) => d.minPayment > 0);
  const target = [...(payable.length > 0 ? payable : debts)].sort(
    (a, b) => b.annualRate - a.annualRate,
  )[0];

  // Порядок «лавины»: дорогие сначала, бесплатные (замороженные) — в конце.
  const order = [...debts].sort((a, b) => b.annualRate - a.annualRate);
  const balances = order.map((d) => d.balance);
  const rates = order.map((d) => d.annualRate);
  const mins = order.map((d) => d.minPayment);

  // Пул в месяц = все обязательные платежи + дополнительный взнос.
  const pool = round2(debts.reduce((acc, d) => acc + d.minPayment, 0) + input.extraPerMonth);

  let months = 0;
  while (balances.some((b) => b > 0.01) && months < MAX_MONTHS) {
    months += 1;
    let available = pool;

    // 1) Проценты за месяц (у замороженных ставка в расчёте уже 0).
    for (let k = 0; k < balances.length; k++) {
      if (balances[k] > 0.01) {
        balances[k] = round2(balances[k] * (1 + rates[k] / 100 / 12));
      }
    }

    const targetIndex = balances.findIndex((b) => b > 0.01);

    // 2) Обязательные платежи по всем долгам, кроме целевого.
    for (let k = 0; k < balances.length; k++) {
      if (k === targetIndex || balances[k] <= 0.01) continue;
      const pay = Math.min(mins[k], balances[k], available);
      if (pay <= 0) continue;
      balances[k] = round2(balances[k] - pay);
      available = round2(available - pay);
      if (available <= 0.01) break;
    }

    // 3) Остаток — в самый дорогой незакрытый долг.
    if (targetIndex !== -1 && available > 0.01) {
      const pay = Math.min(available, balances[targetIndex]);
      balances[targetIndex] = round2(balances[targetIndex] - pay);
    }
  }

  if (months >= MAX_MONTHS) return null;

  return {
    baselineMonths: input.baselineMonths,
    acceleratedMonths: months,
    savedMonths: Math.max(0, input.baselineMonths - months),
    targetName: target.name,
    extraPerMonth: round2(input.extraPerMonth),
  };
}
