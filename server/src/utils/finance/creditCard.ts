import { buildAnnuitySchedule } from './annuity';
import { addMonths, withDayOfMonth } from './date';
import { round2 } from './round';
import type { ScheduleInput, ScheduleItem } from './types';

/**
 * Кредитная карта с льготным периодом.
 *
 * Фаза 1 — льготный период (цикл заморозки 🧊):
 *   пользователь вносит сумму `graceReplenishSum` в день `graceReplenishDay`
 *   («40 000 ₽ каждый месяц для обновления периода»); проценты не начисляются
 *   (interestPart = 0), внесённое уменьшает основной долг.
 *
 * ВАЖНО: пока карта в цикле заморозки, минимального платежа и срока НЕТ.
 * `graceReplenishSum` — это не «минимальный платёж», а сумма обновления
 * беспроцентного периода. В приложении она показывается как
 * «внесите до <день>, чтобы обновить период», а не как платёж по графику.
 * Пропустить её нельзя: тогда льготный период сгорает и банк начисляет проценты.
 *
 * Фаза 2 — если у карты указан конец льготного периода (`gracePeriodEnds`),
 *   остаток после него разбивается аннуитетом на оставшийся срок.
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

  // Нет конца льготного периода — карта живёт в цикле заморозки:
  // никакого графика минимальных платежей не строим.
  // Напоминания об обновлении периода шлёт отдельная джоба (freeze cycle).
  if (!graceEnd) return items;

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
