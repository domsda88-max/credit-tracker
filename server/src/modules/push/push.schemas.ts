import { z } from 'zod';

export const subscribeSchema = z.object({
  endpoint: z.string().url('Некорректный endpoint подписки'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url('Некорректный endpoint подписки'),
});

export type SubscribeDto = z.infer<typeof subscribeSchema>;
export type UnsubscribeDto = z.infer<typeof unsubscribeSchema>;
