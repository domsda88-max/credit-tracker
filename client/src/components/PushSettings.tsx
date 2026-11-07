import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Компактный переключатель Push-уведомлений (iOS-style switch): вместо
 * отдельных кнопок «Включить/Выключить/Проверить» — один тумблер.
 */
export function PushSettings() {
  const { status, error, subscribe, unsubscribe } = usePushNotifications();
  const [pending, setPending] = useState(false);

  const enabled = status === 'subscribed';
  const loading = status === 'loading';

  const toggle = async () => {
    if (pending || loading || status === 'unsupported') return;
    setPending(true);
    try {
      if (enabled) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-t1">Push-уведомления</p>
          <p className="mt-0.5 text-xs text-t3">
            Сводка платежей в выбранное время + напоминания о сроках
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void toggle()}
          disabled={loading || pending || status === 'unsupported'}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
            enabled ? 'bg-primary' : 'bg-surface2'
          }`}
          aria-label="Включить push-уведомления"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-surface shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {status === 'subscribed' && (
        <p className="mt-2 flex items-center gap-1 text-xs text-success">
          Уведомления включены
        </p>
      )}
      {status === 'denied' && (
        <p className="mt-2 text-xs text-warning">
          Уведомления запрещены в браузере. Разрешите их в настройках сайта и попробуйте снова.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="mt-2 text-xs text-warning">
          Этот браузер не поддерживает Web Push. На iPhone добавьте приложение на экран «Домой»
          (Safari → Поделиться → На экран «Домой») и откройте его оттуда.
        </p>
      )}
      {status === 'error' && error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}