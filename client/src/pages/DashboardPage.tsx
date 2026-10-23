import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';
import { DataExport } from '../components/DataExport';
import { DebtOverview } from '../components/DebtOverview';
import { MoneyFlow } from '../components/MoneyFlow';
import { OverdueAlert } from '../components/OverdueAlert';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { formatDate, formatMoney } from '../utils/format';

/** Экран загрузки: бесплатный Render «просыпается» до ~50 секунд — предупреждаем об этом. */
function LoadingScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-sky-400" />
      <p className="text-sm text-t2">Загружаю данные…</p>
      {slow && (
        <p className="max-w-xs text-xs text-t3">
          Сервер просыпается после простоя — это может занять до минуты. Данные появятся сами.
        </p>
      )}
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
  });
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
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
        <div className="rounded-card border border-line bg-surface p-6 text-center">
          <p className="text-lg font-medium text-t1">Пока нет долгов</p>
          <p className="mt-1 text-sm text-t3">
            Добавьте первый кредит, карту или заём — всё будет под контролем
          </p>
          <Link
            to="/credits/new"
            className="mt-4 inline-flex rounded-control bg-primary px-4 py-2.5 font-medium text-white transition hover:bg-primary/90"
          >
            Добавить
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
