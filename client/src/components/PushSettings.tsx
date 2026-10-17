import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushSettings() {
  const { status, error, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-100">Push-напоминания</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Сводка платежей раз в день в 10:00 по вашему времени + предупреждения о заморозке
          </p>
        </div>

        {status === 'subscribed' ? (
          <button
            type="button"
            onClick={() => void unsubscribe()}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300"
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
        </p>
      )}
      {status === 'unsupported' && (
        <p className="mt-2 text-xs text-amber-400">Этот браузер не поддерживает Web Push.</p>
      )}
      {status === 'error' && error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      {status === 'subscribed' && (
        <p className="mt-2 text-xs text-emerald-400">Уведомления включены ✅</p>
      )}
    </div>
  );
}
