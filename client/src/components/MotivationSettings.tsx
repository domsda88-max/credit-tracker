import { useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from './Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Ежедневная мотивационная рассылка.
 * Раз в день в 9:30 по локальному времени приходит вдохновляющее уведомление
 * (30 текстов по циклу). Можно включить/выключить.
 */
export function MotivationSettings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const { status } = usePushNotifications();

  if (!user) return null;

  const enabled = user.motivationEnabled ?? true;

  const toggle = async () => {
    setSaving(true);
    try {
      const updated = await authApi.updateSettings({
        timezone: user.timezone,
        reminderHour: user.reminderHour,
        leadDaysList: user.leadDaysList,
        motivationEnabled: !enabled,
      });
      setUser(updated);
      toast.show(!enabled ? 'Ежедневная мотивация включена' : 'Ежедневная мотивация выключена');
    } catch (err) {
      toast.show(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-t1">Ежедневная мотивация</p>
          <p className="mt-0.5 text-xs text-t3">
            Каждый день в 9:30 — короткое напоминание про досрочное погашение
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void toggle()}
          disabled={saving || status !== 'subscribed'}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? 'bg-primary' : 'bg-surface2'
          }`}
          aria-label="Включить ежедневную мотивацию"
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
              enabled ? 'left-[1.375rem]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-caption">
            <span className="text-t3">Прогресс цикла</span>
            <span className="tabular text-t2">день {user.motivationDay ?? 1} из 30</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-success"
              style={{ width: `${((user.motivationDay ?? 1) / 30) * 100}%` }}
            />
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-t3">
        Нужны включённые push-уведомления (блок выше).
      </p>
    </div>
  );
}
