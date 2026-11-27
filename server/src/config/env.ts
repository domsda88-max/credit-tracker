import 'dotenv/config';
import { z } from 'zod';

/**
 * Валидация переменных окружения на старте.
 * Если чего-то не хватает — сервер падает сразу с понятной ошибкой,
 * а не в рантайме на первом запросе.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET должен быть не короче 16 символов'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY обязателен (npm run vapid:gen)'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY обязателен (npm run vapid:gen)'),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
  CLIENT_ORIGIN: z.string().default('*'),
  TELEGRAM_BOT_TOKEN: z.preprocess((v) => v === '' ? undefined : v, z.string().regex(/^\\d+:[A-Za-z0-9_-]+$/).optional()),
  TELEGRAM_WEBHOOK_SECRET: z.preprocess((v) => v === '' ? undefined : v, z.string().min(16).optional()),
  PUBLIC_BASE_URL: z.preprocess((v) => v === '' ? undefined : v, z.string().url().optional()),
}).superRefine((value, ctx) => {
  const values = [value.TELEGRAM_BOT_TOKEN, value.TELEGRAM_WEBHOOK_SECRET, value.PUBLIC_BASE_URL];
  if (values.some(Boolean) && !values.every(Boolean)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telegram requires TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and PUBLIC_BASE_URL together' });
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`❌ Ошибка конфигурации .env:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
