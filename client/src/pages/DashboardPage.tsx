import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';
import { DataExport } from '../components/DataExport';
import { DebtOverview } from '../components/DebtOverview';
import { OverdueAlert } from '../components/OverdueAlert';
import { PayoffStrategy } from '../components/PayoffStrategy';
import { PushSettings } from '../components/PushSettings';
import { SummaryCards } from '../components/SummaryCards';
import { UpcomingPayments } from '../components/UpcomingPayments';

export function DashboardPage() {
  const {
    data: credits,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Загружаю кредиты…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-400">Не удалось загрузить данные: {(error as Error).message}</p>;
  }

  const list = credits ?? [];
  const active = list.filter((c) => c.status === 'ACTIVE');
  const closed = list.filter((c) => c.status === 'CLOSED');

  return (
    <div className="space-y-4">
      <OverdueAlert credits={list} />
      {list.length > 0 && <DebtOverview />}
      {list.length > 0 && <SummaryCards credits={list} />}

      <PushSettings />

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center">
          <p className="text-slate-300">Пока нет ни одного кредита</p>
          <p className="mt-1 text-sm text-slate-500">
            Добавьте первый — система построит график платежей и напомнит о датах
          </p>
          <Link
            to="/credits/new"
            className="mt-4 inline-block rounded-xl bg-sky-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-sky-400"
          >
            Добавить кредит
          </Link>
        </div>
      ) : (
        <>
          <UpcomingPayments credits={list} />

          <PayoffStrategy credits={list} />

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Активные ({active.length})
            </h2>
            {active.map((credit) => (
              <CreditRow key={credit.id} credit={credit} />
            ))}
          </section>

          {closed.length > 0 && (
            <section className="space-y-3 pt-2">
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
