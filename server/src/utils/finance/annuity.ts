import { round2 } from './round';
import type { ScheduleItem } from './types';

/**
 * Аннуитетный платёж (стандартная банковская формула):
 *
 *        P · i
 *   K = ─────────────
 *       1 − (1+i)^−n
 *
 * где P — сумма кредита, i — месячная ставка (годовая / 100 / 12), n — срок в месяцах.
 */
export function annuityPayment(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0) throw new Error('Срок кредита должен быть больше 0 месяцев');

  const i = annualRate / 100 / 12;
  if (i === 0) return round2(principal / termMonths);

  const payment = (principal * i) / (1 - Math.pow(1 + i, -termMonths));
  return round2(payment);
}

/**
 * График аннуитетных платежей.
 * Проценты начисляются на остаток долга; последний платёж корректируется
 * до полного погашения остатка (защита от накопления копеечных расхождений).
 */
export function buildAnnuitySchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  dueDates: Date[],
): ScheduleItem[] {
  const i = annualRate / 100 / 12;
  const payment = annuityPayment(principal, annualRate, termMonths);

  let balance = round2(principal);
  const items: ScheduleItem[] = [];

  dueDates.forEach((dueDate, index) => {
    const isLast = index === dueDates.length - 1;
    const interestPart = round2(balance * i);

    let principalPart = round2(payment - interestPart);
    let amount = payment;

    // Последний платёж или выход за остаток — закрываем долг точно.
    if (isLast || principalPart >= balance) {
      principalPart = round2(balance);
      amount = round2(principalPart + interestPart);
    }

    balance = round2(balance - principalPart);
    items.push({ dueDate, amount, principalPart, interestPart });
  });

  return items;
}
