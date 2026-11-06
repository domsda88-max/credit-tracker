import { z } from 'zod';

export const earlyRepaymentSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0'),
  mode: z.enum(['REDUCE_TERM']).optional(),
  note: z.string().max(200).optional(),
  date: z.coerce.date().optional(),
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

/** Дата без времени: клиент нормализует «ДД.ММ.ГГГГ» → «ГГГГ-ММ-ДД» до отправки. */
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ожидается дата в формате ГГГГ-ММ-ДД');

export const importPaymentsSchema = z.object({
  rows: z
    .array(
      z.object({
        /** Если в UI разрешили коллизию имён — передаём точный id. */
        creditId: z.string().uuid('Некорректный id кредита').optional(),
        creditName: z.string().trim().min(1).max(200),
        dueDate: dateOnlySchema,
        paidAt: dateOnlySchema.optional(),
        amount: z.number().positive('Сумма должна быть больше 0').optional(),
      }),
    )
    .min(1, 'Нет строк для импорта')
    .max(2000, 'За один раз можно импортировать не более 2000 строк'),
});

export type EarlyRepaymentDto = z.infer<typeof earlyRepaymentSchema>;
export type PayInstallmentDto = z.infer<typeof payInstallmentSchema>;
export type ImportPaymentsDto = z.infer<typeof importPaymentsSchema>;
