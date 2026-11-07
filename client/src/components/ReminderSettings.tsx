import { ChevronDown } from 'lucide-react';
import { useState } from 'react';import { extractErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToast } from './useToast';

/** Час из браузера — предлагаем его как значение по умолчанию при первом открытии. */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Популярные часовые пояса РФ/СНГ + пояс браузера. */
const BASE_TIMEZONES = [
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'Europe/Kyiv',
  'Europe/Minsk',
  'Asia/Almaty',
  'Asia/Tashkent',
  'UTC',
];

const TIMEZONES = Array.from(new Set([browserTimezone(), ...BASE_TIMEZONES]));

/** Варианты «за сколько дней предупреждать». 0 = в сам день платежа. */
const LEAD_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'в день платежа' },
  { value: 1, label: 'за 1 день' },
  { value: 2, label: 'за 2 дня' },
  { value: 3, label: 'за 3 дня' },
  { value: 5, label: 'за 5 дней' },
  { value: 7, label: 'за 7 дней' },
];

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Настройки напоминаний: во сколько приходит сводка и за сколько дней
 * предупреждать о платеже. Можно выбрать несколько дней сразу —
 * например «за 3, за 2, за 1 день и в сам день платежа».
 */
export function ReminderSettings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();

  const [hour, setHour] = useState(user?.reminderHour ?? 10);
  const [leadDaysList, setLeadDaysList] = useState<number[]>(
    user?.leadDaysList && user.leadDaysList.length > 0 ? user.leadDaysList : [3, 2, 1, 0],
  );
  const [timezone, setTimezone] = useState(user?.timezone ?? browserTimezone());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const toggleDay = (day: number) => {
    setLeadDaysList((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => b - a),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateSettings({
        timezone,
        reminderHour: hour,
        leadDaysList,
      });
      setUser(updated);
      toast.show('Настройки напоминаний сохранены');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sameList =
    leadDaysList.length === (user.leadDaysList?.length ?? 0) &&
    leadDaysList.every((d) => user.leadDaysList?.includes(d));
  const dirty = hour !== user.reminderHour || !sameList || timezone !== user.timezone;

  return (
    <div className="p-4">

      <div className="mt-3">
        <span className="text-xs text-t2">Время сводки</span>
        <div className="relative mt-1">
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-full appearance-none rounded-control border border-line bg-surface px-3 py-2.5 pr-10 text-t1 outline-none transition focus:border-primary"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-t3" />
        </div>
      </div>

      <div className="mt-3">
        <span className="text-xs text-t2">Часовой пояс</span>
        <div className="relative mt-1">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full appearance-none rounded-control border border-line bg-surface px-3 py-2.5 pr-10 text-t1 outline-none transition focus:border-primary"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-t3" />
        </div>
      </div>

      <div className="mt-3">
        <span className="text-xs text-t2">Предупреждать заранее (можно несколько)</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {LEAD_OPTIONS.map((opt) => {
            const active = leadDaysList.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleDay(opt.value)}
                className={`rounded-control border px-3 py-1.5 text-xs transition ${
                  active
                    ? 'border-primary bg-primary/15 text-primary-fg'
                    : 'border-line bg-surface text-t2 hover:border-t3'
                }`}
              >
                {active ? '✓ ' : ''}
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-t3">
          Каждый выбранный день — отдельное уведомление. Например: за 3, за 2, за 1 день и в сам
          день платежа.
        </p>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="btn btn-primary text-sm disabled:opacity-50"
        >
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-danger-fg">{error}</p>}
      <p className="mt-2 text-xs text-t3">
        Работает без открытого приложения: уведомление приходит, даже если телефон заблокирован
        (нужно разрешить уведомления и включить push выше).
      </p>
    </div>
  );
}
