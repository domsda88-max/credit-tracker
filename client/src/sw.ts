/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Precache статики (Vite подставит список файлов на этапе сборки)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

interface PushData {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

/** Push от сервера (дайджест, заморозка, milestone). */
self.addEventListener('push', (event: PushEvent) => {
  const data: PushData = (() => {
    try {
      return (event.data?.json() as PushData) ?? {};
    } catch {
      return { body: event.data?.text() };
    }
  })();

  const title = data.title ?? 'Credit Tracker';
  const options: NotificationOptions = {
    body: data.body ?? 'Напоминание о платеже',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag,
    data: { url: data.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/** Клик по уведомлению: фокусируем открытую вкладку или открываем новую. */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            void client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
