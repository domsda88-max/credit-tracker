import { ArrowRight, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { formatMoney } from '../utils/format';

/**
 * Денежный поток месяца: доход → обязательные платежи → свободный остаток.
 * Доход задаётся в настройках; платежи считает сервер по платежам текущего
 * календарного месяца. Резерв грейса показываем отдельно и НЕ включаем
 * ни в регулярные платежи, ни в «Свободно».
 */
export function MoneyFlow() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
  });

  if (!data || data.activeCount === 0) return null;

  const income = data.monthlyIncome;
  const payments = data.monthlyPayments;
  const free = data.freeMoney;
  const graceTotal = data.graceReplenishTotal;
  const hasIncome = income !== null;

  return (
    <section className="card card-pad card-enter">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 section-title">
          <Wallet size={14} />
          Деньги в месяц
        </p>
        <Link to="/settings" className="ui-press rounded-chip px-1 text-caption text-primary-fg">
          {hasIncome ? 'Изменить' : 'Указать доход'}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-inner metric-gloss px-3 py-3">
          <p className="text-micro text-t3">Доход</p>
          <p className="tabular mt-1 text-body font-semibold text-t1">
            {hasIncome ? formatMoney(income) : '—'}
          </p>
        </div>
        <div className="card-inner metric-gloss px-3 py-3">
          <p className="text-micro text-t3">Регулярные платежи</p>
          <p className="tabular mt-1 text-body font-semibold text-t1">
            {formatMoney(payments)}
          </p>
        </div>
      </div>

      {graceTotal > 0 && (
        <p className="mt-2 text-micro text-t3">
          Отдельно: резерв грейса <span className="tabular font-medium text-t2">{formatMoney(graceTotal)}</span> — не входит в платежи
        </p>
      )}

      {data.overpaymentBalance > 0 && (
        <p className="mt-2 text-micro text-t3">
          Принятая переплата <span className="tabular font-medium text-t2">{formatMoney(data.overpaymentBalance)}</span> — отдельно, не уменьшает долг
        </p>
      )}

      <div
        className={`metric-gloss mt-3 flex items-center justify-between gap-3 rounded-control px-3 py-2.5 ${
          free !== null && free < 0 ? 'bg-danger/10' : 'bg-success/10'
        }`}
      >
        <span className="flex items-center gap-1.5 text-caption text-t3">
          Свободно
          <ArrowRight size={14} className="text-t3" />
        </span>
        <span
          className={`tabular text-heading font-bold ${
            free === null ? 'text-t2' : free < 0 ? 'text-danger-fg' : 'text-success-fg'
          }`}
        >
          {free === null ? 'Укажите доход' : formatMoney(free)}
        </span>
      </div>

      {!hasIncome && (
        <p className="mt-2 text-micro text-t3">
          Укажите доход — покажем, сколько остаётся после всех платежей.
        </p>
      )}
      {free !== null && free < 0 && (
        <p className="mt-2 text-micro text-danger-fg">
          Платежи больше дохода на {formatMoney(Math.abs(free))} — стоит пересмотреть нагрузку.
        </p>
      )}
    </section>
  );
}
