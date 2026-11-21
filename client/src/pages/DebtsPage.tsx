import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';

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

  if (isPending && !credits) return <LoadingScreen />;
  if (error) {
    return <p className="text-sm text-danger-fg">Не удалось загрузить данные: {(error as Error).message}</p>;
  }

  const list = credits ?? [];
  const active = list.filter((c) => c.status === 'ACTIVE');
  const closed = list.filter((c) => c.status === 'CLOSED');

  return (
    <div className="page-stack">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Мои долги</h2>
          <span className="text-caption text-t3">{active.length}</span>
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

      {list.length === 0 && (
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
    </div>
  );
}
