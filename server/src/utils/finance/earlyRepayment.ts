import { buildAnnuitySchedule } from './annuity';
import { buildDifferentialSchedule } from './differential';
import { addMonths, withDayOfMonth } from './date';
import { round2 } from './round';
import type { PaymentType, PrepaymentMode, ScheduleItem } from './types';

export interface RebuildInput {
  /** Остаток долга ПОСЛЕ досрочного платежа. */
  outstanding: number;
  annualRate: number;
  paymentType: PaymentType;
  mode: PrepaymentMode;
  /** Сколько месяцев оставалось по исходному графику. */
  remainingTermMonths: number;
  /** Дата следующего платежа (первая строка нового графика). */
  nextDueDate: Date;
  paymentDay?: number | null;
  /** Текущий аннуитетный платёж (для режима сокращения срока). */
  previousPayment?: number | null;
  /** Текущая часть основного долга по дифференциалу. */
  previousPrincipalPart?: number | null;
}

/**
 * Пересборка графика после досрочного погашения.
 *
 * REDUCE_TERM    — платёж остаётся прежним, сокращается срок;
 * REDUCE_PAYMENT — срок остаётся прежним, уменьшается платёж.
 *
 * Кредитка (MIN_PAYMENT) всегда пересчитывается как аннуитет по остатку.
 */
export function rebuildSchedule(input: RebuildInput): ScheduleItem[] {
  const principal = round2(input.outstanding);
  if (principal <= 0) return [];

  const remainingTerm = Math.max(1, Math.round(input.remainingTermMonths));

  // ——— Дифференцированный ———
  if (input.paymentType === 'DIFFERENTIAL') {
    const part = input.previousPrincipalPart ?? 0;
    const months =
      input.mode === 'REDUCE_TERM' && part > 0 ? Math.max(1, Math.ceil(principal / part)) : remainingTerm;

    return buildDifferentialSchedule(
      principal,
      input.annualRate,
      months,
      makeDueDates(input.nextDueDate, months),
    );
  }

  // ——— Аннуитет / кредитка ———
  const i = input.annualRate / 100 / 12;
  let months = remainingTerm;

  const payment = input.previousPayment ?? 0;
  const canShorten = i === 0 ? payment > 0 : payment > principal * i;

  if (input.mode === 'REDUCE_TERM' && canShorten) {
    months =
      i === 0
        ? Math.ceil(principal / payment)
        : Math.ceil(Math.log(1 / (1 - (i * principal) / payment)) / Math.log(1 + i));
    months = Math.max(1, months);
  }

  return buildAnnuitySchedule(
    principal,
    input.annualRate,
    months,
    makeDueDates(input.nextDueDate, months),
  );
}

function makeDueDates(firstDueDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  for (let k = 0; k < count; k++) dates.push(withDayOfMonth(addMonths(firstDueDate, k), null));
  return dates;
}

/** Следующий платёж после сегодняшнего дня (для старта нового графика). */
export function nextScheduleStart(today: Date, paymentDay?: number | null): Date {
  return withDayOfMonth(addMonths(today, 1), paymentDay);
}
