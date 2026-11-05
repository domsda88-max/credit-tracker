import { z } from 'zod';
import { maxPrepaymentDate, utcToday } from '../../utils/finance/date';

export const earlyRepaymentSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0'),
  mode: z.enum(['REDUCE_TERM']).optional(),
  note: z.string().max(200).optional(),
  date: z.coerce
    .date()
    .optional()
    .refine((value) => value === undefined || utcToday(value) <= maxPrepaymentDate(), {
      message: 'Дата внесения не может быть позже чем на 1 год',
    }),
});

/**
 * Отметка платежа по графику. Если поля не переданы — фиксируем полную сумму
 * по графику и сегодняшнюю дату (старое поведение кнопки «Я оплатил»).
 * Можно указать фактическую сумму (недоплата/переплата) и реальную дату платежа.
 */
export const payInstallmentSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0').optional(),
  paidAt: z.coerce.date().optional(),
});

export type EarlyRepaymentDto = z.infer<typeof earlyRepaymentSchema>;
export type PayInstallmentDto = z.infer<typeof payInstallmentSchema>;
