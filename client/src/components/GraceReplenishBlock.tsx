import { AlertTriangle, Snowflake } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { formatMoney, formatDateShort } from '../utils/format';

export function GraceReplenishBlock() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
  });

  if (!data || data.graceReplenishTotal <= 0) return null;

  const today = new Date();
  const overdue = data.graceItems.some((g) => g.dueDate && new Date(g.dueDate) < today);

  return (
    <section
      className={`card animate-fade-up p-4 ${overdue ? 'border-danger/60 bg-danger/10' : 'border-warning/40 bg-warning/10'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-chip ${overdue ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'}`}>
          {overdue ? <AlertTriangle size={18} /> : <Snowflake size={18} />}
        </span>
        <div>
          <p className={`text-body font-semibold ${overdue ? 'text-danger' : 'text-warning'}`}>
            {overdue ? 'ВНИМАНИЕ: грейс-период сбрасывается!' : 'Для сохранения грейса'}
          </p>
          <p className="text-caption text-t2">
            {overdue
              ? 'Начнут капать проценты 34–53%. Внесите сумму срочно.'
              : 'Рекомендованные платежи (не в расходах)'}
          </p>
        </div>
        <span className="ml-auto tabular text-heading font-bold text-t1">
          {formatMoney(data.graceReplenishTotal)}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.graceItems.map((g, i) => (
          <li key={i} className="flex items-center justify-between text-caption text-t2">
            <span className="truncate">{g.name}</span>
            <span className="tabular">
              {formatMoney(g.amount)}
              {g.dueDate && <span className="ml-2 text-t3">до {formatDateShort(g.dueDate)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
