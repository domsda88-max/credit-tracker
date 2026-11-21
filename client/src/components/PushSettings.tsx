import type { PushStatus } from '../hooks/usePushNotifications';

interface Props {
  status: PushStatus;
  error: string | null;
  busy: boolean;
  onToggle: () => void;
}

/**
 * Компактный переключатель Push-уведомлений (iOS-style switch).
 * Состоянием управляет SettingsPage — одна подписка на все блоки настроек.
 */
export function PushSettings({ status, error, busy, onToggle }: Props) {
  const enabled = status === 'subscribed';
  const disabled = busy || status === 'loading' || status === 'unsupported';

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-caption text-t3">
          Сводка платежей в выбранное время + напоминания о сроках
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={onToggle}
          disabled={disabled}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full ${
            enabled ? 'bg-primary' : 'bg-surface2'
          }`}
          aria-label="Включить push-уведомления"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-surface shadow-sm ${
              enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {status === 'subscribed' && (
        <p className="mt-2 flex items-center gap-1 text-xs text-success-fg">
          Уведомления включены
        </p>
      )}
      {status === 'denied' && (
        <p className="mt-2 text-xs text-warning-fg">
          Уведомления запрещены в браузере. Разрешите их в настройках сайта и попробуйте снова.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="mt-2 text-xs text-warning-fg">
          Этот браузер не поддерживает Web Push. На iPhone добавьте приложение на экран «Домой»
          (Safari → Поделиться → На экран «Домой») и откройте его оттуда.
        </p>
      )}
      {status === 'error' && error && <p className="mt-2 text-xs text-danger-fg">{error}</p>}
    </div>
  );
}
