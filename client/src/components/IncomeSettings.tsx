import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { authApi } from '../api/auth';
import { extractErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';
import { formatMoney } from '../utils/format';
import { useToast } from './Toast';

/**
 * Доход в месяц. Нужен, чтобы показать свободные деньги:
 * доход − сумма ежемесячных платежей. Остальные настройки не трогаем —
 * отправляем их текущие значения, т.к. эндпоинт принимает весь объект.
 */
export function IncomeSettings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();

  const [value, setValue] = useState(
    user?.monthlyIncome != null ? String(user.monthlyIncome) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const parsed = value.trim() === '' ? null : Number(value.replace(',', '.'));
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0);
  const dirty = parsed !== (user.monthlyIncome ?? null);

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateSettings({
        timezone: user.timezone,
        reminderHour: user.reminderHour,
        leadDaysList: user.leadDaysList,
        monthlyIncome: parsed,
      });
      setUser(updated);
      toast.show('Доход сохранён');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-success/12 text-success">
          <Wallet size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-t1">Доход в месяц</p>
          <p className="mt-0.5 text-caption text-t3">
            Покажем, сколько остаётся после обязательных платежей
          </p>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="text-caption text-t2">Сумма, ₽</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="1000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Например, 120000"
          className="field"
        />
      </label>

      {user.monthlyIncome != null && !dirty && (
        <p className="mt-2 text-caption text-t3">
          Сейчас: <span className="tabular text-t2">{formatMoney(user.monthlyIncome)}</span>
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty || invalid}
        className="btn btn-primary mt-3 w-full disabled:opacity-50"
      >
        {saving ? '…' : 'Сохранить доход'}
      </button>

      {invalid && <p className="mt-2 text-caption text-danger">Введите неотрицательное число</p>}
      {error && <p className="mt-2 text-caption text-danger">{error}</p>}
    </div>
  );
}
