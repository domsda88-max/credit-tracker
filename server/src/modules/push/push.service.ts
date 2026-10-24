import webpush from 'web-push';
import { prisma } from '../../config/prisma';
import { ensureVapidConfigured, getVapidPublicKey } from '../../config/vapid';
import type { SubscribeDto } from './push.schemas';

/** Полезная нагрузка push-уведомления (формат, который читает Service Worker). */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export const pushService = {
  getPublicKey(): string {
    return getVapidPublicKey();
  },

  /** Сохранить подписку браузера (upsert по endpoint). */
  async saveSubscription(userId: string, dto: SubscribeDto, userAgent?: string) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ?? null,
      },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ?? null,
      },
    });
  },

  async removeSubscription(userId: string, endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  },

  /** Отправить push на все устройства пользователя, чистя «мёртвые» подписки. */
  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    ensureVapidConfigured();

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            JSON.stringify(payload),
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Подписка отозвана браузером — удаляем.
            await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
          } else {
            console.error('[push] Ошибка отправки:', (error as Error).message);
          }
        }
      }),
    );

    return subscriptions.length;
  },
};

/**
 * Идемпотентная отправка: сначала пытаемся записать факт в NotificationLog
 * (dedupKey уникален) — если запись уже есть, уведомление не отправляем повторно.
 */
export async function sendUniquePush(
  userId: string,
  creditId: string | null,
  type: string,
  dedupKey: string,
  payload: PushPayload,
): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({ where: { dedupKey } });
  if (existing) return false;
  try {
    await prisma.notificationLog.create({
      data: { userId, creditId, type, dedupKey, payload: { ...payload } },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }

  await pushService.sendToUser(userId, payload);
  return true;
}
