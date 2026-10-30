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

  let remainingTerm = Math.max(1, Math.round(input.remainingTermMonths));
  if (!Number.isFinite(remainingTerm) || remainingTerm < 1) {
    throw new Error('Некорректный оставшийся срок');
  }
  if (remainingTerm > 600) {
    throw new Error('Слишком большой оставшийся срок при пересчёте');
  }

  // ——— Дифференцированный ———
  if (input.paymentType === 'DIFFERENTIAL') {
    const part = input.previousPrincipalPart ?? 0;
    let months =
      input.mode === 'REDUCE_TERM' && part > 0 ? Math.max(1, Math.ceil(principal / part)) : remainingTerm;
    if (!Number.isFinite(months) || months < 1) months = remainingTerm;
    if (months > 600) throw new Error('Некорректный срок пересчёта');
    const dates = makeDueDates(input.nextDueDate, months);
    if (dates.length !== months) throw new Error('Ошибка построения дат графика');

    return buildDifferentialSchedule(principal, input.annualRate, months, dates);
  }

  // ——— Аннуитет / кредитка ———
  const i = input.annualRate / 100 / 12;
  let months = remainingTerm;

  const payment = input.previousPayment ?? 0;
  const canShorten = i === 0 ? payment > 0 : payment > principal * i + 1e-9;

  if (input.mode === 'REDUCE_TERM' && canShorten && payment > 0 && Number.isFinite(payment)) {
    let monthsCalc: number;
    if (i === 0) {
      monthsCalc = Math.ceil(principal / payment);
    } else {
      const numerator = i * principal;
      const denomFactor = numerator / payment;
      if (denomFactor >= 1 - 1e-12) {
        throw new Error('Платёж слишком мал для сокращения срока');
      }
      monthsCalc = Math.ceil(Math.log(1 / (1 - denomFactor)) / Math.log(1 + i));
    }
    if (!Number.isFinite(monthsCalc) || monthsCalc <= 0) {
      throw new Error('Не удалось рассчитать срок при досрочном погашении');
    }
    months = Math.max(1, monthsCalc);
  }

  if (months > 600) throw new Error('Слишком большой срок пересчёта');
  const dates = makeDueDates(input.nextDueDate, months);
  if (dates.length !== months) throw new Error('Ошибка построения дат графика');

  return buildAnnuitySchedule(principal, input.annualRate, months, dates);
}

function makeDueDates(firstDueDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  for (let k = 0; k < count; k++) {
    dates.push(withDayOfMonth(addMonths(firstDueDate, k), null));
  }
  return dates;
}

/** Следующий платёж после сегодняшнего дня (для старта нового графика). */
export function nextScheduleStart(today: Date, paymentDay?: number | null): Date {
  return withDayOfMonth(addMonths(today, 1), paymentDay);
}
