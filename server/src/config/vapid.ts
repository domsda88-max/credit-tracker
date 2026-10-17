import webpush from 'web-push';
import { env } from './env';

let configured = false;

/**
 * Инициализация VAPID-ключей для Web Push.
 * Ключи генерируются один раз: `npm run vapid:gen` → в .env.
 */
export function ensureVapidConfigured(): void {
  if (configured) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

export function getVapidPublicKey(): string {
  return env.VAPID_PUBLIC_KEY;
}
