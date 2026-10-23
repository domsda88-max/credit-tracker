import { useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from './Toast';

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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-100">Ежедневная мотивация</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Каждый день в 9:30 — короткое напоминание про досрочное погашение
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void toggle()}
          disabled={saving}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? 'bg-sky-500' : 'bg-slate-700'
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
        <p className="mt-2 text-xs text-slate-500">
          Тексты подстраиваются под твои кредиты: самый дорогой долг, карты в заморозке,
          ипотека, сумма и дата свободы. Всего 30 сценариев, потом цикл повторяется.
          Сейчас день <span className="text-slate-300">{user.motivationDay ?? 1}</span> из 30.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Нужны включённые push-уведомления (блок выше).
      </p>
    </div>
  );
}
