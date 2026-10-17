import { buildAnnuitySchedule } from './annuity';
import { buildCreditCardSchedule } from './creditCard';
import { buildDueDates } from './date';
import { buildDifferentialSchedule } from './differential';
import type { ScheduleInput, ScheduleItem } from './types';

/**
 * Единая точка входа для построения графика платежей.
 * Выбирает стратегию по типу платежа — контроллеры и сервисы
 * не знают о конкретной математике.
 */
export function generateSchedule(input: ScheduleInput): ScheduleItem[] {
  switch (input.type) {
    case 'ANNUITY':
      return buildAnnuitySchedule(
        input.principal,
        input.annualRate,
        input.termMonths,
        buildDueDates(input.startDate, input.termMonths, input.paymentDay),
      );

    case 'DIFFERENTIAL':
      return buildDifferentialSchedule(
        input.principal,
        input.annualRate,
        input.termMonths,
        buildDueDates(input.startDate, input.termMonths, input.paymentDay),
      );

    case 'MIN_PAYMENT':
      return buildCreditCardSchedule(input);

    default: {
      const never: never = input.type;
      throw new Error(`Неизвестный тип платежа: ${String(never)}`);
    }
  }
}
