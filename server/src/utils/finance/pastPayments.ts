import { addMonths, utcToday } from './date';
import { round2 } from './round';
import type { ScheduleItem } from './types';

/** Что уже прошло по графику: оплаченные строки и пересчитанный остаток долга. */
export interface PastPaymentsPlan {
  /** Дата, по которую (включительно) платежи считаются внесёнными. */
  cutoff: Date;
  /** Количество платежей, которые уже должны были состояться. */
  paidCount: number;
  /** Сколько всего платежей в графике. */
  totalCount: number;
  /** Сумма всех «прошедших» платежей (то, что вы уже заплатили банку). */
  paidTotal: number;
  /** Из них — в счёт основного долга. */
  paidPrincipal: number;
  /** Начисленные по графику проценты за прошедшие платежи. */
  paidInterest: number;
  /** Остаток основного долга после этих платежей. */
  outstanding: number;
  /** Ожидаемый платёж (первый в графике) — для сверки с выпиской банка. */
  expectedPayment: number;
}

/**
 * Считает, что уже оплачено, если кредит оформлен в прошлом.
 *
 * Схема: все строки графика с датой ≤ сегодняшнего дня (для незакрытых кредитов —
 * кроме последней) считаются внесёнными. Из суммы основного долга вычитается
 * «телесная» часть этих платежей, поэтому остаток соответствует реальности.
 */
export interface PlanPastPaymentsOptions {
  /**
   * Явный режим `markPastAsPaid: true` (импорт/создание).
   * Означает, что caller осознанно считает прошедшие по дате платежи оплаченными.
   * Не является подтверждением фактической оплаты сам по себе — это разрешение
   * эвристики для сценария создания/импорта.
   */
  assumeAllDuePaid?: boolean;
}

export function planPastPayments(
  schedule: ScheduleItem[],
  now: Date = new Date(),
  options?: PlanPastPaymentsOptions,
): PastPaymentsPlan {
  const today = utcToday(now);
  const totalCount = schedule.length;

  let cutoffIndex = schedule.findIndex((item) => item.dueDate > today);
  if (cutoffIndex === -1) cutoffIndex = totalCount; // все даты в прошлом

  // Незакрытый кредит: последний платёж ещё не наступил — исключаем его,
  // иначе остаток обнулился бы и кредит считался бы погашенным.
  const assumeAllDuePaid = options?.assumeAllDuePaid === true;

  let paidCount = cutoffIndex;
  // По умолчанию последний платёж не закрывается одной датой: это защита от
  // автозакрытия кредита при импорте/пересчёте без явного подтверждения оплаты.
  // Явный режим assumeAllDuePaid разрешает считать прошедшие по дате платежи
  // оплаченными (см. markPastAsPaid: true), но не подменяет статус PAID в БД.
  if (!assumeAllDuePaid && paidCount >= totalCount) {
    paidCount = Math.max(0, totalCount - 1);
  }

  const paid = schedule.slice(0, paidCount);
  const paidTotal = round2(paid.reduce((sum, item) => sum + item.amount, 0));
  const paidPrincipal = round2(paid.reduce((sum, item) => sum + item.principalPart, 0));
  const paidInterest = round2(paid.reduce((sum, item) => sum + item.interestPart, 0));

  const principalTotal = round2(schedule.reduce((sum, item) => sum + item.principalPart, 0));
  const outstanding = round2(Math.max(0, principalTotal - paidPrincipal));

  const cutoff = paid.length > 0 ? paid[paid.length - 1].dueDate : addMonths(today, 0);

  return {
    cutoff,
    paidCount,
    totalCount,
    paidTotal,
    paidPrincipal,
    paidInterest,
    outstanding,
    expectedPayment: schedule[0]?.amount ?? 0,
  };
}
