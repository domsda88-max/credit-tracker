import { z } from 'zod';

export const creditTypeEnum = z.enum([
  'CREDIT_CARD',
  'CONSUMER',
  'MORTGAGE',
  'INSTALLMENT',
  'MICROLOAN',
  'LOAN',
]);

export const paymentTypeEnum = z.enum(['ANNUITY', 'DIFFERENTIAL', 'MIN_PAYMENT']);
export const prepaymentModeEnum = z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']);

const baseFields = {
  name: z.string().min(1, 'Укажите название').max(100),
  type: creditTypeEnum,
  paymentType: paymentTypeEnum.optional(),
  prepaymentMode: prepaymentModeEnum.optional(),
  principal: z.number().positive('Сумма должна быть больше 0').max(1_000_000_000),
  annualRate: z.number().min(0, 'Ставка не может быть отрицательной').max(100, 'Ставка слишком высокая'),
  startDate: z.coerce.date(),
  termMonths: z.number().int().min(0).max(600).optional().nullable(),
  paymentDay: z.number().int().min(1).max(31).optional().nullable(),
  minPayment: z.number().min(0).optional().nullable(),
  gracePeriodEnds: z.coerce.date().optional().nullable(),
  graceReplenishSum: z.number().min(0).optional().nullable(),
  graceReplenishDay: z.number().int().min(1).max(31).optional().nullable(),
  frozen: z.boolean().optional(),
  freezeCycleDays: z.number().int().min(1).max(365).optional().nullable(),
  /** true — прошедшие по графику платежи сразу пометить оплаченными (кредит оформлен раньше). */
  markPastAsPaid: z.boolean().optional(),
  /** Фактический остаток долга сейчас (если известен точнее расчёта). */
  outstanding: z.number().min(0).optional().nullable(),
};

export const createCreditSchema = z
  .object(baseFields)
  .superRefine((data, ctx) => {
    if (data.type === 'LOAN') {
      // Для займа минимальный платёж и срок не обязательны
      if (data.termMonths !== undefined && data.termMonths !== null && data.termMonths < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Срок некорректен', path: ['termMonths'] });
      }
      return;
    }
    if (!data.paymentType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите тип платежа', path: ['paymentType'] });
    }
    if (data.termMonths === undefined || data.termMonths === null || data.termMonths < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Срок — минимум 1 месяц', path: ['termMonths'] });
    }
  });

export const updateCreditSchema = z
  .object({
    ...baseFields,
    name: baseFields.name.optional(),
    type: creditTypeEnum.optional(),
    paymentType: paymentTypeEnum.optional(),
    principal: baseFields.principal.optional(),
    annualRate: baseFields.annualRate.optional(),
    startDate: z.coerce.date().optional(),
    termMonths: baseFields.termMonths.optional(),
  })
  .partial();

export const toggleFreezeSchema = z.object({
  frozen: z.boolean(),
});

export type CreateCreditDto = z.infer<typeof createCreditSchema>;
export type UpdateCreditDto = z.infer<typeof updateCreditSchema>;
export type ToggleFreezeDto = z.infer<typeof toggleFreezeSchema>;
