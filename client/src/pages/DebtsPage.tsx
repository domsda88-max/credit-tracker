import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { creditsApi } from '../api/credits';
import { CreditRow } from '../components/CreditRow';

export function DebtsPage() {
  const { data: credits, isPending, error } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    staleTime: 60_000,
  });

  if (isPending) return <div className="page-stack"><div className="skeleton h-28 rounded-card" /><div className="skeleton h-28 rounded-card" /></div>;
  if (error) return <p className="card card-pad text-sm text-danger-fg">Не удалось загрузить долги.</p>;

  const active = (credits ?? []).filter((credit) => credit.status === 'ACTIVE');
  const closed = (credits ?? []).filter((credit) => credit.status === 'CLOSED');

  return (
    <div className="page-stack animate-fade-in">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="section-title">Все обязательства</p>
          <h1 className="text-2xl font-bold tracking-tight text-t1">Долги</h1>
          <p className="mt-1 text-sm text-t3">{active.length} активных · {closed.length} закрытых</p>
        </div>
        <Link to="/credits/new" className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-bg transition active:scale-95">
          <Plus size={17} /> Добавить
        </Link>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-t1">Активные</h2>
          <span className="text-xs text-t3">{active.length}</span>
        </div>
        {active.length ? active.map((credit) => <CreditRow key={credit.id} credit={credit} />) : (
          <div className="card card-pad text-center">
            <p className="font-semibold text-t1">Активных долгов нет</p>
            <p className="mt-1 text-sm text-t3">Добавьте кредит или заём, чтобы видеть его здесь</p>
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-t1">Закрытые</h2>
          {closed.map((credit) => <CreditRow key={credit.id} credit={credit} />)}
        </section>
      )}
    </div>
  );
}
