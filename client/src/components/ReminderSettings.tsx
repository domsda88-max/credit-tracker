import { useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';

/** Час из браузера — предлагаем его как значение по умолчанию при первом открытии. */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

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

  const [hour, setHour] = useState(user?.reminderHour ?? 10);
  const [leadDaysList, setLeadDaysList] = useState<number[]>(
    user?.leadDaysList && user.leadDaysList.length > 0 ? user.leadDaysList : [3, 2, 1, 0],
  );
  const [timezone, setTimezone] = useState(user?.timezone ?? browserTimezone());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    try {
      const updated = await authApi.updateSettings({
        timezone,
        reminderHour: hour,
        leadDaysList,
      });
      setUser(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="font-medium text-slate-100">Напоминания</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Во сколько присылать сводку и за сколько дней предупреждать о платеже
      </p>

      <div className="mt-3">
        <span className="text-xs text-slate-400">Время сводки</span>
        <select
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <span className="text-xs text-slate-400">Предупреждать заранее (можно несколько)</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {LEAD_OPTIONS.map((opt) => {
            const active = leadDaysList.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleDay(opt.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  active
                    ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                }`}
              >
                {active ? '✓ ' : ''}
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Каждый выбранный день — отдельное уведомление. Например: за 3, за 2, за 1 день и в сам
          день платежа.
        </p>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? 'Сохраняю…' : saved ? 'Сохранено ✅' : 'Сохранить'}
        </button>
        <span className="ml-3 text-xs text-slate-500">часовой пояс: {timezone}</span>
      </div>

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">
        Работает без открытого приложения: уведомление приходит, даже если телефон заблокирован
        (нужно разрешить уведомления и включить push выше).
      </p>
      <p className="mt-1 text-xs text-slate-500">
        🧊 По кредиткам с циклом заморозки отдельно предупредим за 2 дня до его окончания — чтобы вы
        успели пополнить карту и продлить льготный период.
      </p>
    </div>
  );
}
