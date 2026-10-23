import { useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { pushApi } from '../api/push';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useToast } from './Toast';

export function PushSettings() {
  const { status, error, subscribe, unsubscribe } = usePushNotifications();
  const toast = useToast();
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    try {
      const sent = await pushApi.sendTest();
      toast.show(sent > 0 ? `Отправлено на устройств: ${sent}` : 'Нет активных подписок');
    } catch (err) {
      toast.show(extractErrorMessage(err), 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-t1">Push-уведомления</p>
          <p className="mt-0.5 text-xs text-t3">
            Сводка платежей в выбранное время + напоминания о сроках
          </p>
        </div>

        {status === 'subscribed' ? (
          <button
            type="button"
            onClick={() => void unsubscribe()}
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm text-t2 transition hover:border-rose-500/50 hover:text-danger"
          >
            Выключить
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={status === 'loading' || status === 'unsupported'}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {status === 'loading' ? 'Включаю…' : 'Включить'}
          </button>
        )}
      </div>

      {status === 'denied' && (
        <p className="mt-2 text-xs text-amber-400">
          Уведомления запрещены в браузере. Разрешите их в настройках сайта и попробуйте снова.
          На iPhone: Настройки → Уведомления → это приложение.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="mt-2 text-xs text-amber-400">
          Этот браузер не поддерживает Web Push. На iPhone добавьте приложение на экран «Домой»
          (Safari → Поделиться → На экран «Домой») и откройте его оттуда.
        </p>
      )}
      {status === 'error' && error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {status === 'subscribed' && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-success">Уведомления включены ✅</p>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-t2 transition hover:border-primary/50 disabled:opacity-50"
          >
            {testing ? 'Отправляю…' : 'Проверить'}
          </button>
        </div>
      )}
    </div>
  );
}
