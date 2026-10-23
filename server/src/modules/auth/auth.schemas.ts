import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(72, 'Пароль слишком длинный'),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

/**
 * Настройки напоминаний. Все поля необязательны — обновляем только то, что прислали.
 * `timezone` проверяем через Intl: неверная строка там бросит RangeError.
 * `leadDaysList` — список дней, за сколько предупреждать (0 = в день платежа),
 * например [3, 2, 1, 0] = за 3, за 2, за 1 день и в сам день.
 */
export const updateSettingsSchema = z.object({
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('ru-RU', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Неизвестный часовой пояс'),
  reminderHour: z.coerce.number().int().min(0).max(23),
  leadDaysList: z
    .array(z.coerce.number().int().min(0).max(14))
    .max(15)
    .transform((days) => [...new Set(days)].sort((a, b) => b - a)),
  motivationEnabled: z.boolean().optional(),
  /** Доход в месяц, ₽. null / пусто — не задан. */
  monthlyIncome: z
    .union([z.null(), z.literal(''), z.coerce.number().min(0).max(1_000_000_000)])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
