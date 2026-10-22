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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-100">Push-уведомления</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Сводка платежей в выбранное время + напоминания о сроках
          </p>
        </div>

        {status === 'subscribed' ? (
          <button
            type="button"
            onClick={() => void unsubscribe()}
            className="shrink-0 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300"
          >
            Выключить
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={status === 'loading' || status === 'unsupported'}
            className="shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
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
      {status === 'error' && error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      {status === 'subscribed' && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-400">Уведомления включены ✅</p>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing}
            className="shrink-0 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/50 disabled:opacity-50"
          >
            {testing ? 'Отправляю…' : 'Проверить'}
          </button>
        </div>
      )}
    </div>
  );
}
