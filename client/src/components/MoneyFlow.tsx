import { ArrowRight, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { formatMoney } from '../utils/format';

/**
 * Денежный поток месяца: доход → обязательные платежи → свободный остаток.
 * Доход задаётся в настройках; платежи считает сервер по ближайшим платежам
 * всех активных долгов (у замороженных карт — сумма обновления периода).
 */
export function MoneyFlow() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: creditsApi.summary,
  });

  if (!data || data.activeCount === 0) return null;

  const income = data.monthlyIncome;
  const payments = data.monthlyPayments;
  const free = data.freeMoney;
  const hasIncome = income !== null;

  return (
    <section className="card animate-fade-up p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 section-title">
          <Wallet size={14} />
          Деньги в месяц
        </p>
        <Link to="/settings" className="text-caption text-primary">
          {hasIncome ? 'Изменить' : 'Указать доход'}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-inner px-3 py-2.5">
          <p className="text-micro text-t3">Доход</p>
          <p className="tabular mt-0.5 text-body font-semibold text-t1">
            {hasIncome ? formatMoney(income) : '—'}
          </p>
        </div>
        <div className="card-inner px-3 py-2.5">
          <p className="text-micro text-t3">Платежи в месяц</p>
          <p className="tabular mt-0.5 text-body font-semibold text-t1">
            {formatMoney(payments)}
          </p>
        </div>
      </div>

      <div
        className={`mt-3 flex items-center justify-between gap-3 rounded-control px-3 py-2.5 ${
          free !== null && free < 0 ? 'bg-danger/10' : 'bg-success/10'
        }`}
      >
        <span className="flex items-center gap-1.5 text-caption text-t2">
          Свободно
          <ArrowRight size={14} className="text-t3" />
        </span>
        <span
          className={`tabular text-heading font-bold ${
            free === null ? 'text-t2' : free < 0 ? 'text-danger' : 'text-success'
          }`}
        >
          {free === null ? '—' : formatMoney(free)}
        </span>
      </div>

      {!hasIncome && (
        <p className="mt-2 text-micro text-t3">
          Укажите доход — покажем, сколько остаётся после всех платежей.
        </p>
      )}
      {free !== null && free < 0 && (
        <p className="mt-2 text-micro text-danger">
          Платежи больше дохода на {formatMoney(Math.abs(free))} — стоит пересмотреть нагрузку.
        </p>
      )}
    </section>
  );
}
