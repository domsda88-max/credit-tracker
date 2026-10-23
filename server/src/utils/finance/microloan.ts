import { addUTCDays } from './date';
import { round2 } from './round';
import type { ScheduleItem } from './types';

/**
 * МФО — баллонный платёж в конце срока (в днях).
 *
 * Формула: amount = principal * (1 + annualRate/100 * termDays/365)
 * Один платёж через termDays дней от даты выдачи.
 */
export function buildMicroloanSchedule(input: {
  principal: number;
  annualRate: number;
  startDate: Date;
  termDays: number;
  paymentDay?: number | null;
}): ScheduleItem[] {
  const { principal, annualRate, startDate, termDays } = input;

  if (termDays < 1 || termDays > 365) {
    throw new Error('Срок займа должен быть от 1 до 365 дней');
  }

  //.amount = principal * (1 + annualRate/100 * termDays/365)
  const totalAmount = round2(principal * (1 + (annualRate / 100) * (termDays / 365)));
  const interestPart = round2(totalAmount - principal);
  const principalPart = round2(principal);

  const dueDate = addUTCDays(new Date(startDate), termDays);

  return [
    {
      dueDate,
      amount: totalAmount,
      principalPart,
      interestPart,
    },
  ];
}
