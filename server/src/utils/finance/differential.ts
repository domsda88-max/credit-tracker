import { round2 } from './round';
import type { ScheduleItem } from './types';

/**
 * График дифференцированных платежей.
 * Основной долг делится поровну на срок; проценты начисляются на остаток.
 * Итог: платежи убывают со временем.
 */
export function buildDifferentialSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  dueDates: Date[],
): ScheduleItem[] {
  if (termMonths <= 0) throw new Error('Срок кредита должен быть больше 0 месяцев');

  const i = annualRate / 100 / 12;
  const basePrincipalPart = round2(principal / termMonths);

  let balance = round2(principal);
  return dueDates.map((dueDate, index) => {
    const isLast = index === dueDates.length - 1;
    const interestPart = round2(balance * i);

    // Последний платёж добирает остаток, чтобы график сходился в ноль.
    const principalPart = isLast ? round2(balance) : Math.min(basePrincipalPart, balance);
    balance = round2(balance - principalPart);

    return {
      dueDate,
      amount: round2(principalPart + interestPart),
      principalPart,
      interestPart,
    };
  });
}
