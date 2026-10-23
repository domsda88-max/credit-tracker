import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';
import { DataExport } from '../components/DataExport';
import { DebtOverview } from '../components/DebtOverview';
import { MoneyFlow } from '../components/MoneyFlow';
import { OverdueAlert } from '../components/OverdueAlert';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { formatDate, formatMoney } from '../utils/format';

/** Экран загрузки: скелетоны карточек вместо спиннера. */
function LoadingScreen() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-24 rounded-card" />
      ))}
    </div>
  );
}

export function DashboardPage() {
  const {
    data: credits,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    placeholderData: keepPreviousData,
  });
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
    placeholderData: keepPreviousData,
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <p className="text-sm text-danger">Не удалось загрузить данные: {(error as Error).message}</p>;
  }

  const list = credits ?? [];
  const active = list.filter((c) => c.status === 'ACTIVE');
  const closed = list.filter((c) => c.status === 'CLOSED');
  const percentPaid = summary && summary.principalSum > 0 ? Math.min(100, Math.round((summary.paidByPrincipal / summary.principalSum) * 100)) : 0;

  return (
    <div className="space-y-4">
      <OverdueAlert credits={list} />

      {list.length > 0 && summary && summary.activeCount > 0 && (
        <section className="rounded-card border border-line bg-gradient-to-br from-primary/10 via-transparent to-success/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-t2">Всего к погашению</p>
              <p className="mt-1 tabular text-2xl font-semibold text-t1 sm:text-3xl">
                {formatMoney(summary.outstandingSum)}
              </p>
            </div>
            {summary.debtFreeDate && (
              <div className="text-right">
                <p className="text-xs text-t3">Последний платёж</p>
                <p className="mt-1 text-sm text-t2">{formatDate(summary.debtFreeDate)}</p>
              </div>
            )}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-success"
              style={{ width: `${percentPaid}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-t3">
            <span>Погашено: {formatMoney(summary.paidByPrincipal)}</span>
            <span>Выплачено всего: {formatMoney(summary.totalPaidSum)}</span>
          </div>
        </section>
      )}

      {list.length > 0 && <DebtOverview />}
      <MoneyFlow />

      <UpcomingPayments credits={list} />

      {list.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-8 text-center">
          <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <circle cx="48" cy="48" r="44" fill="rgb(var(--c-surface2))" />
            <path
              d="M30 52c0-9.94 8.06-18 18-18s18 8.06 18 18"
              stroke="rgb(var(--c-primary))"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="40" cy="44" r="3" fill="rgb(var(--c-t2))" />
            <circle cx="56" cy="44" r="3" fill="rgb(var(--c-t2))" />
            <path
              d="M40 62c2.5 2.5 5.5 3.5 8 3.5s5.5-1 8-3.5"
              stroke="rgb(var(--c-success))"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-heading font-semibold text-t1">Пока нет долгов</p>
          <p className="max-w-xs text-caption text-t3">
            Добавьте первый кредит, карту или заём — всё будет под контролем
          </p>
          <Link
            to="/credits/new"
            className="btn btn-primary"
          >
            Добавить первый долг
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-t1">Мои долги</h2>
              <Link to="/credits/new" className="text-sm text-primary hover:text-primary">
                + Добавить
              </Link>
            </div>
            {active.map((credit) => (
              <CreditRow key={credit.id} credit={credit} />
            ))}
          </section>

          {closed.length > 0 && (
            <section className="space-y-2 pt-1">
              <h2 className="text-sm font-medium uppercase tracking-wide text-t3">
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
