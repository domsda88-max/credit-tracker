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
      className={`card animate-fade-up p-4 ${overdue ? 'border-sky-400/70 bg-sky-950/60 dark:bg-sky-950/60' : 'border-sky-300 bg-sky-50 dark:border-sky-400/60 dark:bg-sky-950/60'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-chip ${overdue ? 'bg-sky-400/25 text-sky-300' : 'bg-sky-200 text-sky-700 dark:bg-sky-400/25 dark:text-sky-300'}`}>
          {overdue ? <AlertTriangle size={18} /> : <Snowflake size={18} />}
        </span>
        <div>
          <p className={`text-body font-semibold ${overdue ? 'text-sky-200 dark:text-sky-200' : 'text-sky-700 dark:text-sky-200'}}`}>
            {overdue ? 'ВНИМАНИЕ: грейс-период сбрасывается!' : 'Для сохранения грейса'}
          </p>
          <p className="text-caption text-t2">
            {overdue
              ? 'Начнут капать проценты 34–53%. Внесите сумму срочно.'
              : 'Рекомендованные платежи (не в расходах)'}
          </p>
        </div>
        <span className="ml-auto tabular text-heading font-bold ${overdue ? 'text-sky-100 dark:text-sky-100' : 'text-sky-900 dark:text-sky-100'}">
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
