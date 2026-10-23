import { AlertTriangle, Snowflake } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { formatMoney, formatDateShort } from '../utils/format';

export function GraceReplenishBlock() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
  });

  if (!data || !data.graceItems?.length) return null;

  const today = new Date();
  const overdue = data.graceItems.some((g) => g.dueDate && new Date(g.dueDate) < today);

  // Карусель грейса: одни и те же деньги ходят по картам.
  // Показываем最大单次 платёж, а не сумму всех карт.
  const maxPayment = Math.max(...data.graceItems.map((g) => g.amount));

  return (
    <section
      className={`card animate-fade-up p-4 ${overdue ? 'border-cyan-500 bg-cyan-950/30' : 'border-cyan-500/40 bg-cyan-950/20'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-chip ${overdue ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
          {overdue ? <AlertTriangle size={18} /> : <Snowflake size={18} />}
        </span>
        <div>
          <p className={`text-body font-semibold ${overdue ? 'text-cyan-400' : 'text-cyan-400'}`}>
            {overdue ? 'ВНИМАНИЕ: грейс-период сбрасывается!' : 'Для сохранения грейса'}
          </p>
          <p className="text-caption text-t2">
            {overdue
              ? 'Начнут капать проценты 34–53%. Внесите сумму срочно.'
              : 'Рекомендованные платежи (не в расходах)'}
          </p>
        </div>
        <span className="ml-auto tabular text-heading font-bold text-cyan-200">
          {formatMoney(maxPayment)}
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
