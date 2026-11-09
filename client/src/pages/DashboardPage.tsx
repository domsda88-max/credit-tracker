import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';
import { DebtOverview } from '../components/DebtOverview';
import { MoneyFlow } from '../components/MoneyFlow';
import { GraceReplenishBlock } from '../components/GraceReplenishBlock';
import { OverdueAlert } from '../components/OverdueAlert';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { PayoffStrategy } from '../components/PayoffStrategy';

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
    isPending,
    error,
  } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Скелетон — только на первом холодном загрузке. При возврате из кэша
  // показываем прошлые данные, а не мигающую заглушку.
  if (isPending && !credits) {
    return <LoadingScreen />;
  }

  if (error) {
    return <p className="text-sm text-danger-fg">Не удалось загрузить данные: {(error as Error).message}</p>;
  }

  const list = credits ?? [];
  const active = list.filter((c) => c.status === 'ACTIVE');
  const closed = list.filter((c) => c.status === 'CLOSED');

  return (
    <div className="space-y-4 animate-fade-in page--dashboard">
      <OverdueAlert credits={list} />

      <DebtOverview />
      <MoneyFlow />
      <GraceReplenishBlock />

      <UpcomingPayments credits={list} />

      <PayoffStrategy credits={list} />

      {/* === МОИ ДОЛГИ: карточки активных долгов === */}
      <section className="space-y-3">
        <h2 className="section-title">Мои долги</h2>
        {active.length === 0 ? (
          <p className="py-4 text-center text-caption text-t3">Нет активных долгов</p>
        ) : (
          <>
            {active.map((credit) => (
              <CreditRow key={credit.id} credit={credit} />
            ))}
          </>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-2 pt-1 border-t border-line pt-4">
          <h2 className="section-title">Закрытые</h2>
          {closed.map((credit) => (
            <CreditRow key={credit.id} credit={credit} />
          ))}
        </section>
      )}

      {list.length === 0 && (
        <div className="card flex flex-col items-center gap-4 p-8 text-center">
          <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <circle cx="48" cy="48" r="44" fill="var(--color-surface-sunken)" />
            <path
              d="M30 52c0-9.94 8.06-18 18-18s18 8.06 18 18"
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="40" cy="44" r="3" fill="var(--color-ink-muted)" />
            <circle cx="56" cy="44" r="3" fill="var(--color-ink-muted)" />
            <path
              d="M40 62c2.5 2.5 5.5 3.5 8 3.5s5.5-1 8-3.5"
              stroke="var(--color-success)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="sr-only">Пока нет долгов</p>
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
      )}
    </div>
  );
}
