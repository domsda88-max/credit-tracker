import { ChevronDown, Clock } from 'lucide-react';
import { extractErrorMessage } from '../api/client';
import { useState } from 'react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from './Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { motivationSlots } from '../utils/motivation';

export function MotivationSettings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();
  const { status } = usePushNotifications();

  const [time, setTime] = useState(user?.motivationTime ?? '09:30');
  const [perDay, setPerDay] = useState(user?.motivationPerDay ?? 1);

  if (!user) return null;

  const enabled = user.motivationEnabled ?? true;

  const toggle = async () => {
    const prev = user;
    setUser({ ...user, motivationEnabled: !enabled });
    try {
      const updated = await authApi.updateSettings({
        timezone: user.timezone,
        reminderHour: user.reminderHour,
        leadDaysList: user.leadDaysList,
        motivationEnabled: !enabled,
      });
      setUser(updated);
      toast.show(!enabled ? 'Мотивация включена' : 'Мотивация выключена');
    } catch (err) {
      setUser(prev);
      toast.show(extractErrorMessage(err), 'error');
    }
  };

  const save = async () => {
    const prev = user;
    setUser({ ...user, motivationTime: time, motivationPerDay: perDay });
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
      setUser(prev);
      toast.show(extractErrorMessage(err), 'error');
    }
  };

  const times = motivationSlots(time, perDay);
  const cycleDay = Math.min(70, Math.max(1, user.motivationDay ?? 1));
  const cycleProgress = Math.min(100, Math.round((cycleDay / 70) * 100));

  return (
    <div className="p-4">
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
          disabled={status !== 'subscribed'}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
            enabled ? 'bg-primary' : 'bg-surface2'
          }`}
          aria-label="Включить ежедневную мотивацию"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-surface shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-t2">Время</span>
              <div className="relative mt-1">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  min="00:00"
                  max="23:59"
                  step={60}
                  className="field pr-10"
                />
                <Clock size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-t3" />
              </div>
            </label>
            <label className="block">
              <span className="text-sm text-t2">Частота</span>
              <div className="relative mt-1">
                <select
                  value={perDay}
                  onChange={(e) => setPerDay(Number(e.target.value))}
                  className="w-full appearance-none rounded-control border border-line bg-surface px-3 py-2 pr-10 text-t1"
                >
                <option value={1}>1 раз в день</option>
                <option value={2}>2 раза в день</option>
                <option value={3}>3 раза в день</option>
                <option value={4}>4 раза в день</option>
                <option value={6}>6 раз в день</option>
                <option value={8}>8 раз в день</option>
                <option value={12}>12 раз в день</option>
                <option value={24}>Каждый час</option>
              </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-t3" />
              </div>
            </label>
          </div>
          <p className="text-xs text-t3">
            Уведомления в: {times.join(', ')}
          </p>
          <button
            type="button"
            onClick={() => void save()}
            className="btn btn-primary w-full text-sm disabled:opacity-50"
          >
            Сохранить
          </button>
          <div className="flex items-center justify-between text-caption">
            <span className="text-t3">Мотивационный цикл</span>
            <span className="tabular text-t2">сообщение {cycleDay} из 70</span>
          </div>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2"
            role="progressbar"
            aria-label="Прогресс мотивационного цикла"
            aria-valuemin={0}
            aria-valuemax={70}
            aria-valuenow={cycleDay}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-500 ease-app"
              style={{ width: `${cycleProgress}%` }}
            />
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-t3">Нужны включённые push-уведомления (блок выше).</p>
    </div>
  );
}
