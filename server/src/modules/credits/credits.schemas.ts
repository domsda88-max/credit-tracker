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

const optionalDays = () =>
  z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v == null ? undefined : v))
    .refine((v) => v === undefined || (v >= 1 && v <= 365), {
      message: 'Значение от 1 до 365 дней',
    });

const baseFields = {
  name: z.string().min(1, 'Укажите название').max(100),
  type: creditTypeEnum,
  paymentType: paymentTypeEnum.optional(),
  prepaymentMode: prepaymentModeEnum.optional(),
  principal: z.number().positive('Сумма должна быть больше 0').max(1_000_000_000),
  annualRate: z.number().min(0, 'Ставка не может быть отрицательной').max(100, 'Ставка слишком высокая').optional(),
  startDate: z.coerce.date().optional(),
  termMonths: z.number().int().min(0).max(600).optional().nullable(),
  termDays: optionalDays(),
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
    // ----- Кредитная карта -----
    if (data.type === 'CREDIT_CARD') {
      if (data.annualRate === undefined || data.annualRate === null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых', path: ['annualRate'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
      return;
    }

    // ----- Потребительский кредит / Ипотека -----
    if (data.type === 'CONSUMER' || data.type === 'MORTGAGE') {
      if (!data.paymentType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Выберите тип платежа', path: ['paymentType'] });
      }
      if (data.annualRate === undefined || data.annualRate === null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых', path: ['annualRate'] });
      }
      if (!data.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите дату выдачи', path: ['startDate'] });
      }
      if (!data.termMonths || data.termMonths <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в месяцах', path: ['termMonths'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
      return;
    }

    // ----- Рассрочка / Сплит -----
    if (data.type === 'INSTALLMENT') {
      if (!data.termMonths || data.termMonths <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в месяцах', path: ['termMonths'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
      return;
    }

    // ----- Займ / МФО -----
    if (data.type === 'MICROLOAN') {
      if (data.annualRate === undefined || data.annualRate === null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых', path: ['annualRate'] });
      }
      if (!data.termDays) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в днях (1–365)', path: ['termDays'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
      return;
    }

    // ----- Заем (частный) — PRIVATE_LOAN -----
    if (data.type === 'LOAN') {
      // Ставка не обязательна — по умолчанию 0%. Срок не нужен.
      return;
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
    termDays: baseFields.termDays,
  })
  .partial();

export const toggleFreezeSchema = z.object({
  frozen: z.boolean(),
});

export type CreateCreditDto = z.infer<typeof createCreditSchema>;
export type UpdateCreditDto = z.infer<typeof updateCreditSchema>;
export type ToggleFreezeDto = z.infer<typeof toggleFreezeSchema>;
