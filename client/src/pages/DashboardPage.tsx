import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';
import { DataExport } from '../components/DataExport';
import { DebtOverview } from '../components/DebtOverview';
import { OverdueAlert } from '../components/OverdueAlert';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { formatDate, formatMoney } from '../utils/format';

export function DashboardPage() {
  const {
    data: credits,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
  });
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: creditsApi.summary,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Загружаю данные…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-400">Не удалось загрузить данные: {(error as Error).message}</p>;
  }

  const list = credits ?? [];
  const active = list.filter((c) => c.status === 'ACTIVE');
  const closed = list.filter((c) => c.status === 'CLOSED');
  const percentPaid = summary && summary.principalSum > 0 ? Math.min(100, Math.round((summary.paidByPrincipal / summary.principalSum) * 100)) : 0;

  return (
    <div className="space-y-4">
      <OverdueAlert credits={list} />

      {list.length > 0 && summary && summary.activeCount > 0 && (
        <section className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-sky-500/10 via-transparent to-emerald-400/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Всего к погашению</p>
              <p className="mt-1 tabular text-2xl font-semibold text-slate-100 sm:text-3xl">
                {formatMoney(summary.outstandingSum)}
              </p>
            </div>
            {summary.debtFreeDate && (
              <div className="text-right">
                <p className="text-xs text-slate-500">Последний платёж</p>
                <p className="mt-1 text-sm text-slate-300">{formatDate(summary.debtFreeDate)}</p>
              </div>
            )}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
              style={{ width: `${percentPaid}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Погашено: {formatMoney(summary.paidByPrincipal)}</span>
            <span>Выплачено всего: {formatMoney(summary.totalPaidSum)}</span>
          </div>
        </section>
      )}

      {list.length > 0 && <DebtOverview />}

      <UpcomingPayments credits={list} />

      {list.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-lg font-medium text-slate-100">Пока нет долгов</p>
          <p className="mt-1 text-sm text-slate-500">
            Добавьте первый кредит, карту или заём — всё будет под контролем
          </p>
          <Link
            to="/credits/new"
            className="mt-4 inline-flex rounded-xl bg-sky-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-sky-400"
          >
            Добавить
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Мои долги</h2>
              <Link to="/credits/new" className="text-sm text-sky-400 hover:text-sky-300">
                + Добавить
              </Link>
            </div>
            {active.map((credit) => (
              <CreditRow key={credit.id} credit={credit} />
            ))}
          </section>

          {closed.length > 0 && (
            <section className="space-y-2 pt-1">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Закрытые ({closed.length})
              </h2>
              {closed.map((credit) => (
                <CreditRow key={credit.id} credit={credit} />
              ))}
            </section>
          )}

          <DataExport />
        </>
      )}
    </div>
  );
}
