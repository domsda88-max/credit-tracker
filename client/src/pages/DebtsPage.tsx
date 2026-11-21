import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Landmark, Plus } from 'lucide-react';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';
import { PaymentsPage } from './PaymentsPage';

function LoadingScreen() {
  return (
    <div className="page-stack">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-28 rounded-card" />
      ))}
    </div>
  );
}

export function DebtsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'payments' ? 'payments' : 'debts';
  const setView = (view: 'debts' | 'payments') => {
    setSearchParams(view === 'payments' ? { view: 'payments' } : {}, { replace: true });
  };

  const {
    data: credits,
    isPending,
    error,
  } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: activeView === 'debts',
  });

  return (
    <div className="page-stack">
      <div className="rounded-control border border-line bg-surface2/80 p-1">
        <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Раздел долгов">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'debts'}
            onClick={() => setView('debts')}
            className={`ui-press flex items-center justify-center gap-2 rounded-[11px] px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeView === 'debts' ? 'bg-surface text-primary-fg shadow-sm' : 'text-t3'
            }`}
          >
            <Landmark size={16} aria-hidden="true" />
            Долги
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'payments'}
            onClick={() => setView('payments')}
            className={`ui-press flex items-center justify-center gap-2 rounded-[11px] px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeView === 'payments' ? 'bg-surface text-primary-fg shadow-sm' : 'text-t3'
            }`}
          >
            <CalendarDays size={16} aria-hidden="true" />
            Платежи
          </button>
        </div>
      </div>

      <div key={activeView} className="route-enter">
        {activeView === 'payments' ? (
          <PaymentsPage />
        ) : isPending && !credits ? (
          <LoadingScreen />
        ) : error ? (
          <p className="text-sm text-danger-fg">Не удалось загрузить данные: {(error as Error).message}</p>
        ) : (
          <DebtList credits={credits ?? []} />
        )}
      </div>
    </div>
  );
}

function DebtList({ credits }: { credits: Awaited<ReturnType<typeof creditsApi.list>> }) {
  const active = credits.filter((c) => c.status === 'ACTIVE');
  const closed = credits.filter((c) => c.status === 'CLOSED');

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Мои долги</h2>
          <div className="flex items-center gap-3">
            <span className="text-caption text-t3">{active.length}</span>
            <Link to="/credits/new" className="btn btn-primary !min-h-0 !rounded-full !px-3 !py-2 !text-xs">
              <Plus size={15} aria-hidden="true" />
              Добавить долг
            </Link>
          </div>
        </div>
        {active.length === 0 ? (
          <div className="card card-pad card-enter text-center">
            <p className="text-body font-semibold text-t1">Активных долгов нет</p>
            <p className="mt-1 text-caption text-t3">Все кредиты закрыты — отличная работа</p>
          </div>
        ) : (
          active.map((credit, index) => <CreditRow key={credit.id} credit={credit} index={index} />)
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Закрытые</h2>
          {closed.map((credit, index) => (
            <CreditRow key={credit.id} credit={credit} index={index} />
          ))}
        </section>
      )}

      {credits.length === 0 && (
        <div className="card card-pad card-enter flex flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface2 text-primary-fg">
            <Plus size={22} aria-hidden="true" />
          </span>
          <p className="text-heading font-semibold text-t1">Пока нет долгов</p>
          <p className="max-w-xs text-caption text-t3">
            Добавьте первый кредит, карту или заём — всё будет под контролем
          </p>
          <Link to="/credits/new" className="btn btn-primary">
            Добавить первый долг
          </Link>
        </div>
      )}
    </>
  );
}
