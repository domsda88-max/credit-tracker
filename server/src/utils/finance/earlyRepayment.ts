import { AppError } from '../../middlewares/errorHandler';
import { annuityPayment, buildAnnuitySchedule } from './annuity';
import { buildDifferentialSchedule } from './differential';
import {
  addMonths,
  buildDueDates,
  daysInMonth,
  diffInDaysUTC,
  maxPrepaymentDate,
  monthsBetween,
  utcToday,
  withDayOfMonth,
} from './date';
import { round2, toNumber } from './round';
import type { PaymentType, ScheduleItem } from './types';

/** Меньше копейки — считаем долг закрытым. */
export const CLOSE_THRESHOLD = 0.01;

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
    const dates = makeDueDates(input.nextDueDate, months, input.paymentDay);
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
  const dates = makeDueDates(input.nextDueDate, months, input.paymentDay);
  if (dates.length !== months) throw new Error('Ошибка построения дат графика');

  return buildAnnuitySchedule(principal, input.annualRate, months, dates);
}

/**
 * Даты графика считаем от НЕПОДВИЖНОГО якоря (год/месяц первой даты + paymentDay).
 * Раньше каждая следующая дата строилась от предыдущей, поэтому после февраля
 * платёж 31-го числа «залипал» на 28-м: 31.01 → 28.02 → 28.03 → 28.04.
 */
function makeDueDates(firstDueDate: Date, count: number, paymentDay?: number | null): Date[] {
  const anchor = new Date(Date.UTC(firstDueDate.getUTCFullYear(), firstDueDate.getUTCMonth(), 1));
  const day = paymentDay && paymentDay > 0 ? paymentDay : firstDueDate.getUTCDate();
  const dates: Date[] = [];
  for (let k = 0; k < count; k++) {
    const month = addMonths(anchor, k);
    dates.push(
      new Date(
        Date.UTC(
          month.getUTCFullYear(),
          month.getUTCMonth(),
          Math.min(day, daysInMonth(month.getUTCFullYear(), month.getUTCMonth())),
        ),
      ),
    );
  }
  return dates;
}

/** Следующий платёж после сегодняшнего дня (для старта нового графика). */
export function nextScheduleStart(today: Date, paymentDay?: number | null): Date {
  return withDayOfMonth(addMonths(today, 1), paymentDay);
}

/**
 * Первая дата графика после досрочки.
 * Если платёж внесён до очередной даты в этом месяце, следующий платёж остаётся
 * в этом же месяце; если в саму дату или позже — переносимся на следующий месяц.
 */
function nextDueDateAfter(date: Date, paymentDay?: number | null): Date {
  const day = paymentDay ?? date.getUTCDate();
  const currentMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const candidate = withDayOfMonth(currentMonth, day);
  if (candidate.getTime() > utcToday(date).getTime()) return candidate;
  return withDayOfMonth(addMonths(currentMonth, 1), day);
}

/** Общие входные данные для пересборки графика при досрочке. */
export interface PrepaymentCreditLike {
  schedule: Array<{
    status: string;
    dueDate: Date;
    amount: unknown;
    principalPart: unknown;
  }>;
  startDate: Date;
  termMonths: number;
  paymentDay?: number | null;
  paymentType: string;
  annualRate: unknown;
}

/**
 * Единственная точка построения графика после досрочки.
 * Preview и apply обязаны вызывать её с одними и теми же данными — иначе
 * пользователю показывается один прогноз, а в БД пишется другой.
 */
export function scheduleAfterPrepayment(
  credit: PrepaymentCreditLike,
  prepaymentDateUTC: Date,
  newOutstanding: number,
): ScheduleItem[] {
  const pending = credit.schedule.filter((item) => item.status === 'PENDING');
  const remainingTerm = Math.max(
    1,
    monthsBetween(prepaymentDateUTC, addMonths(credit.startDate, credit.termMonths)),
  );
  const nextDueDate = nextDueDateAfter(prepaymentDateUTC, credit.paymentDay);
  const reference = pending[0] ?? null;
  const annualRate = toNumber(credit.annualRate);

  const previousPayment = credit.paymentType === 'DIFFERENTIAL'
    ? (reference ? toNumber(reference.principalPart) : null)
    : (reference
        ? toNumber(reference.amount)
        : (() => {
            try {
              return annuityPayment(newOutstanding, annualRate, remainingTerm);
            } catch {
              return null;
            }
          })());

  return rebuildSchedule({
    outstanding: newOutstanding,
    annualRate,
    paymentType: credit.paymentType as PaymentType,
    remainingTermMonths: remainingTerm,
    nextDueDate,
    paymentDay: credit.paymentDay,
    previousPayment,
    previousPrincipalPart: reference ? toNumber(reference.principalPart) : null,
  });
}

/** Нижняя и верхняя границы даты досрочного погашения. */
export function assertPrepaymentDate(date: Date, startDate: Date, now: Date = new Date()): void {
  if (date < startDate) throw new AppError(400, 'Дата внесения не может быть раньше даты выдачи');
  if (date > maxPrepaymentDate(now)) throw new AppError(400, 'Дата внесения не может быть позже чем на 1 год');
}

export interface PrepaymentSplit {
  /** Запрошенная сумма после вычета начисленных процентов (может быть отрицательной). */
  principalPart: number;
  /** Тело, которым реально уменьшается долг. */
  principalToBalance: number;
  /** Деньги сверх остатка долга — отдельный резерв, не погашение. */
  overpayment: number;
  /** Остаток после платежа (никогда не отрицательный). */
  newOutstanding: number;
}

/**
 * Единый расчёт досрочного платежа для preview и apply.
 * Переплата принимается, но не уменьшает долг ниже нуля и не считается
 * погашением несуществующего тела.
 */
export function splitPrepaymentAmount(
  amount: number,
  outstanding: number,
  accruedInterest: number,
): PrepaymentSplit {
  const principalPart = round2(amount - accruedInterest);
  const balance = round2(Math.max(0, outstanding));
  const positivePrincipal = round2(Math.max(0, principalPart));
  const principalToBalance = round2(Math.min(positivePrincipal, balance));
  const overpayment = round2(Math.max(0, positivePrincipal - balance));
  const newOutstanding = round2(Math.max(0, balance - principalToBalance));

  return { principalPart, principalToBalance, overpayment, newOutstanding };
}

/** Проценты, накопленные с anchor по дату погашения (UTC-дни). */
export function accruedInterestFor(
  outstanding: number,
  annualRate: number,
  from: Date,
  to: Date,
): { accruedInterest: number; days: number } {
  const days = diffInDaysUTC(from, to);
  const accruedInterest = annualRate > 0 ? round2((outstanding * annualRate * days) / 100 / 365) : 0;
  return { accruedInterest, days };
}

/** Anchor: последний PAID со сроком <= даты погашения, иначе дата выдачи. */
export function prepaymentAnchorDate(
  schedule: Array<{ status: string; dueDate: Date }>,
  prepaymentDate: Date,
  startDate: Date,
): Date {
  const paid = schedule
    .filter((s) => s.status === 'PAID' && s.dueDate.getTime() <= prepaymentDate.getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const lastPaidDue = paid[paid.length - 1]?.dueDate;
  return lastPaidDue ? utcToday(lastPaidDue) : utcToday(startDate);
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
  // График кредита начинается со следующего месяца после выдачи — как и в generateSchedule.
  const dueDates0 = buildDueDates(startDate, termMonths, paymentDay);
  const initialSchedule = paymentType === 'DIFFERENTIAL'
    ? buildDifferentialSchedule(principal, annualRate, termMonths, dueDates0)
    : buildAnnuitySchedule(principal, annualRate, termMonths, dueDates0);

  if (earlyRepayments.length === 0) {
    return { outstanding: principal, schedule: initialSchedule };
  }

  let outstanding = principal;
  let anchorDate = new Date(startDate);
  let schedule = initialSchedule;
  const sorted = [...earlyRepayments].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const er of sorted) {
    // До досрочки по графику уже шли обычные платежи — их тело нужно вычесть,
    // иначе остаток и начисленные проценты завышены на месяцы амортизации.
    const passed = schedule.filter(
      (item) => item.dueDate.getTime() > anchorDate.getTime() && item.dueDate.getTime() <= er.date.getTime(),
    );
    for (const item of passed) {
      outstanding = Math.max(0, round2(outstanding - item.principalPart));
    }
    if (passed.length > 0) {
      anchorDate = new Date(passed[passed.length - 1].dueDate);
    }

    const accruedInterest = accruedInterestBetween(outstanding, annualRate, anchorDate, er.date);
    const principalPart = Math.max(0, round2(er.amount - accruedInterest));
    outstanding = Math.max(0, round2(outstanding - principalPart));

    const remainingMonths = Math.max(1, monthsBetween(er.date, addMonths(startDate, termMonths)));
    const nextDue = nextDueDateAfter(er.date, paymentDay);
    // Сохраняем платёж, который был ДО пересборки: режим «сокращение срока».
    const paymentBefore = passed.length > 0 && passed[passed.length - 1].amount > 0
      ? passed[passed.length - 1].amount
      : (schedule[0]?.amount ?? null);
    const principalBefore = passed.length > 0 ? passed[passed.length - 1].principalPart : (schedule[0]?.principalPart ?? null);

    schedule = rebuildSchedule({
      outstanding,
      annualRate,
      paymentType,
      remainingTermMonths: remainingMonths,
      nextDueDate: nextDue,
      paymentDay,
      previousPayment: paymentBefore,
      previousPrincipalPart: principalBefore,
    });

    anchorDate = new Date(er.date);
  }

  return { outstanding: round2(outstanding), schedule };
}