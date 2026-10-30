import { useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from './Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function MotivationSettings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const { status } = usePushNotifications();

  const [time, setTime] = useState(user?.motivationTime ?? '09:30');
  const [perDay, setPerDay] = useState(user?.motivationPerDay ?? 1);

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

  const save = async () => {
    setSaving(true);
    try {
      const updated = await authApi.updateSettings({
        timezone: user.timezone,
        reminderHour: user.reminderHour,
        leadDaysList: user.leadDaysList,
        motivationTime: time,
        motivationPerDay: perDay,
      });
      setUser(updated);
      toast.show('Сохранено');
    } catch (err) {
      toast.show(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const interval = perDay > 0 ? Math.floor(24 / perDay) : 24;
  const times = Array.from({ length: perDay }, (_, i) => {
    const hh = (parseInt(time.split(':')[0], 10) + i * interval) % 24;
    return `${hh.toString().padStart(2, '0')}:00`;
  });

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-t1">Ежедневная мотивация</p>
          <p className="mt-0.5 text-xs text-t3">
            Каждый день — короткое напоминание про досрочное погашение
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
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-t2">Время</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-t1"
              />
            </label>
            <label className="block">
              <span className="text-sm text-t2">Частота</span>
              <select
                value={perDay}
                onChange={(e) => setPerDay(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-t1"
              >
                <option value={1}>1 раз в день</option>
                <option value={2}>2 раза в день (каждые 12 ч)</option>
                <option value={3}>3 раза в день (каждые 8 ч)</option>
                <option value={4}>4 раза в день (каждые 6 ч)</option>
                <option value={6}>6 раз в день (каждые 4 ч)</option>
                <option value={8}>8 раз в день (каждые 3 ч)</option>
                <option value={12}>12 раз в день (каждые 2 ч)</option>
                <option value={24}>Каждый час</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-t3">
            Уведомления в: {times.join(', ')}
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-full rounded-control bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Сохранить
          </button>
          <div className="flex items-center justify-between text-caption">
            <span className="text-t3">Мотивационный цикл</span>
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
      <p className="mt-2 text-xs text-t3">Нужны включённые push-уведомления (блок выше).</p>
    </div>
  );
}