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

  const maxPayment = Math.max(...data.graceItems.map((g) => g.amount));

  return (
    <section
      className={`card animate-fade-up p-4 ${overdue
          ? 'border-sky-500/40 bg-sky-950/40 dark:border-sky-500/40 dark:bg-sky-950/40'
          : 'border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-950/40'
        }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-chip ${
          overdue
            ? 'bg-sky-500/20 text-sky-300'
            : 'bg-sky-200 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
        }`}>
          {overdue ? <AlertTriangle size={18} /> : <Snowflake size={18} />}
        </span>
        <div>
          <p className={`text-body font-semibold ${
            overdue ? 'text-sky-300' : 'text-sky-700 dark:text-sky-300'
          }`}>
            {overdue ? 'Внимание: грейс-период слетает!' : 'Резерв для сохранения грейса'}
          </p>
          <p className="text-caption text-slate-600 dark:text-slate-400">
            {overdue
              ? 'Необходимо пополнить карту для продления льготного периода.'
              : 'Платёж для обновления льготного периода (карусель)'}
          </p>
        </div>
        <span className={`ml-auto tabular text-heading font-bold ${
          overdue ? 'text-sky-200' : 'text-sky-900 dark:text-sky-200'
        }`}>
          {formatMoney(maxPayment)}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.graceItems.map((g, i) => (
          <li key={i} className="flex items-center justify-between text-caption text-slate-700 dark:text-slate-200">
            <span className="truncate">{g.name}</span>
            <span className="tabular">
              {formatMoney(g.amount)}
              {g.dueDate && <span className="ml-2 text-slate-400 dark:text-slate-400">до {formatDateShort(g.dueDate)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
