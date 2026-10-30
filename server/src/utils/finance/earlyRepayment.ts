import { buildAnnuitySchedule } from './annuity';
import { buildDifferentialSchedule } from './differential';
import { addMonths, monthsBetween, withDayOfMonth } from './date';
import { round2 } from './round';
import type { PaymentType, ScheduleItem } from './types';

export interface RebuildInput {
  /** Остаток долга ПОСЛЕ досрочного платежа. */
  outstanding: number;
  annualRate: number;
  paymentType: PaymentType;
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
 * Всегда REDUCE_TERM: сохраняем платёж близким к прежнему, сокращаем срок.
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
      part > 0 ? Math.max(1, Math.ceil(principal / part)) : remainingTerm;
    if (!Number.isFinite(months) || months < 1) months = remainingTerm;
    if (months > 600) throw new Error('Некорректный срок пересчёта');
    const dates = makeDueDates(input.nextDueDate, months);
    if (dates.length !== months) throw new Error('Ошибка построения дат графика');

    return buildDifferentialSchedule(principal, input.annualRate, months, dates);
  }

  // ——— Аннуитет / кредитка ———
  const i = input.annualRate / 100 / 12;
  const targetPayment = input.previousPayment ?? 0;

  let months: number;
  if (targetPayment > 0 && i > 0 && targetPayment > principal * i) {
    months = Math.ceil(Math.log(1 / (1 - (i * principal) / targetPayment)) / Math.log(1 + i));
  } else if (i === 0 && targetPayment > 0) {
    months = Math.ceil(principal / targetPayment);
  } else {
    months = Math.max(1, remainingTerm);
  }
  months = Math.max(1, months);

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

function nextDueDateAfter(date: Date, paymentDay?: number | null): Date {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return withDayOfMonth(base, paymentDay ?? date.getUTCDate());
}

function accruedInterestBetween(outstanding: number, annualRate: number, from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / msPerDay));
  return annualRate > 0 ? round2((outstanding * annualRate * diffDays) / 100 / 365) : 0;
}

export function applyHistoricalPrepayments(
  principal: number,
  annualRate: number,
  paymentType: PaymentType,
  startDate: Date,
  termMonths: number,
  paymentDay: number | null,
  earlyRepayments: Array<{ amount: number; date: Date }>,
): { outstanding: number; schedule: ScheduleItem[] } {
  if (earlyRepayments.length === 0) {
    const dueDates = Array.from({ length: termMonths }, (_, k) => withDayOfMonth(addMonths(startDate, k), null));
    const schedule = paymentType === 'DIFFERENTIAL'
      ? buildDifferentialSchedule(principal, annualRate, termMonths, dueDates)
      : buildAnnuitySchedule(principal, annualRate, termMonths, dueDates);
    return { outstanding: principal, schedule };
  }

  let outstanding = principal;
  let anchorDate = new Date(startDate);
  const dueDates0 = Array.from({ length: termMonths }, (_, k) => withDayOfMonth(addMonths(startDate, k), null));
  let schedule = paymentType === 'DIFFERENTIAL'
    ? buildDifferentialSchedule(principal, annualRate, termMonths, dueDates0)
    : buildAnnuitySchedule(principal, annualRate, termMonths, dueDates0);

  const sorted = [...earlyRepayments].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const er of sorted) {
    const accruedInterest = accruedInterestBetween(outstanding, annualRate, anchorDate, er.date);
    const principalPart = Math.max(0, er.amount - accruedInterest);
    outstanding = Math.max(0, outstanding - principalPart);

    const remainingMonths = Math.max(1, monthsBetween(er.date, addMonths(startDate, termMonths)));
    const nextDue = nextDueDateAfter(er.date, paymentDay);

    schedule = rebuildSchedule({
      outstanding,
      annualRate,
      paymentType,
      remainingTermMonths: remainingMonths,
      nextDueDate: nextDue,
      paymentDay,
      previousPayment: schedule[0]?.amount ?? null,
      previousPrincipalPart: schedule[0]?.principalPart ?? null,
    });

    anchorDate = new Date(er.date);
  }

  return { outstanding: round2(outstanding), schedule };
}