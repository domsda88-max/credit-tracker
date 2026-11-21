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
      className={`card animate-fade-up p-4 ${
        overdue ? 'border-critical/40 bg-critical/10' : 'border-warm/30 bg-warm/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-chip ${
            overdue ? 'bg-critical/15 text-critical-fg' : 'bg-warm/15 text-warm-fg'
          }`}
        >
          {overdue ? <AlertTriangle size={18} /> : <Snowflake size={18} />}
        </span>
        <div>
          <p className={`text-body font-semibold ${overdue ? 'text-critical-fg' : 'text-t1'}`}>
            {overdue ? 'Внимание: грейс-период слетает!' : 'Резерв для сохранения грейса'}
          </p>
          <p className="text-caption text-t2">
            {overdue
              ? 'Необходимо пополнить карту для продления льготного периода.'
              : 'Платёж для обновления льготного периода (карусель)'}
          </p>
        </div>
        <span className="ml-auto tabular text-heading font-bold text-t1">
          {formatMoney(maxPayment)}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.graceItems.map((g, i) => (
          <li key={i} className="flex items-center justify-between text-caption text-t2">
            <span className="truncate">{g.name}</span>
            <span className="tabular">
              {formatMoney(g.amount)}
              {g.dueDate && (
                <span className="ml-2 text-t3">до {formatDateShort(g.dueDate)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
