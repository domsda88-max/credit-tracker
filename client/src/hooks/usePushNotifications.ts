import { useCallback, useEffect, useState } from 'react';
import { pushApi } from '../api/push';
import { extractErrorMessage } from '../api/client';
import { urlBase64ToUint8Array } from '../utils/push';

export type PushStatus =
  | 'idle'
  | 'loading'
  | 'subscribed'
  | 'denied'
  | 'unsupported'
  | 'error';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // При загрузке смотрим, есть ли уже активная подписка
  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled && subscription) setStatus('subscribed');
      } catch {
        /* игнорируем — покажем кнопку «Включить» */
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = await pushApi.getPublicKey();

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Не удалось получить данные подписки');
      }

      await pushApi.subscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setStatus('subscribed');
    } catch (err) {
      setError(extractErrorMessage(err));
      setStatus('error');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setStatus('idle');
        return;
      }
      await pushApi.unsubscribe(subscription.endpoint);
      await subscription.unsubscribe();
      setStatus('idle');
    } catch (err) {
      setError(extractErrorMessage(err));
      setStatus('error');
    }
  }, []);

  return { status, error, subscribe, unsubscribe };
}
