import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { creditsApi } from '../api/credits';
import { MoneyFlow } from '../components/MoneyFlow';
import { GraceReplenishBlock } from '../components/GraceReplenishBlock';
import { OverdueAlert } from '../components/OverdueAlert';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { formatDateShort, formatMoneyShort } from '../utils/format';

/** Экран загрузки: скелетоны карточек вместо спиннера. */
function LoadingScreen() {
  return (
    <div className="page-stack">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-28 rounded-card" />
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

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
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

  return (
    <div className="page-stack">
      {/* 1. Главный блок — ближайшие платежи */}
      <UpcomingPayments credits={list} />

      {/* 2. Ежемесячная финансовая нагрузка */}
      {list.length > 0 && <MoneyFlow />}

      {/* 3. Короткая сводка: только самое нужное, без дублирования списка долгов */}
      {summary && summary.activeCount > 0 && (
        <section className="card card-pad card-enter">
          <div className="flex items-center justify-between gap-3">
            <p className="section-title">Сводка</p>
            <Link
              to="/stats"
              className="ui-press flex items-center gap-0.5 rounded-chip px-1 text-caption text-primary-fg"
            >
              Аналитика <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <p className="text-micro text-t3">Активные долги</p>
              <p className="tabular mt-1 text-body font-semibold text-t1">{summary.activeCount}</p>
            </div>
            <div className="min-w-0">
              <p className="text-micro text-t3">Остаток</p>
              <p className="tabular mt-1 truncate text-body font-semibold text-t1">
                {formatMoneyShort(summary.outstandingSum)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-micro text-t3">Свобода</p>
              <p className="tabular mt-1 truncate text-body font-semibold text-t1">
                {summary.debtFreeDate ? formatDateShort(summary.debtFreeDate) : '—'}
              </p>
            </div>
          </div>
        </section>
      )}

      <OverdueAlert credits={list} />
      <GraceReplenishBlock />

      {list.length === 0 && (
        <div className="card card-pad card-enter flex flex-col items-center gap-4 text-center">
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
          <Link to="/credits/new" className="btn btn-primary">
            Добавить первый долг
          </Link>
        </div>
      )}
    </div>
  );
}
