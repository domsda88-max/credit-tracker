import { z } from 'zod';

export const earlyRepaymentSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше 0'),
  mode: z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']).optional(),
  note: z.string().max(200).optional(),
});

export type EarlyRepaymentDto = z.infer<typeof earlyRepaymentSchema>;
