import { buildAnnuitySchedule } from './annuity';
import { addMonths, withDayOfMonth } from './date';
import { round2 } from './round';
import type { ScheduleInput, ScheduleItem } from './types';

/**
 * Кредитная карта с льготным периодом.
 *
 * Фаза 1 — льготный период (цикл заморозки 🧊):
 *   пользователь вносит сумму `graceReplenishSum` в день `graceReplenishDay`
 *   («43 000 ₽ каждый месяц для обновления периода»); проценты не начисляются
 *   (interestPart = 0), внесённое уменьшает основной долг.
 *
 * Фаза 2 — после `gracePeriodEnds` остаток разбивается аннуитетом
 *   на оставшийся срок (`termMonths` минус месяцы льготного периода).
 */
export function buildCreditCardSchedule(input: ScheduleInput): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const graceEnd = input.gracePeriodEnds ?? null;
  const replenishDay = input.graceReplenishDay ?? input.paymentDay;

  let balance = round2(input.principal);
  let gracePayments = 0;
  let cursor = withDayOfMonth(addMonths(input.startDate, 1), replenishDay);

  while (graceEnd && cursor <= graceEnd && balance > 0) {
    const amount = round2(Math.min(input.graceReplenishSum ?? 0, balance));
    items.push({ dueDate: cursor, amount, principalPart: amount, interestPart: 0 });
    balance = round2(balance - amount);
    gracePayments += 1;
    cursor = withDayOfMonth(addMonths(cursor, 1), replenishDay);
  }

  if (balance > 0) {
    const remainingMonths = Math.max(1, input.termMonths - gracePayments);
    const dueDates: Date[] = [];
    for (let k = 0; k < remainingMonths; k++) {
      dueDates.push(withDayOfMonth(addMonths(cursor, k), input.paymentDay));
    }
    items.push(...buildAnnuitySchedule(balance, input.annualRate, remainingMonths, dueDates));
  }

  return items;
}
