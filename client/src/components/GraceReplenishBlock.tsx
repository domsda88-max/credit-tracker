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
      className={`card animate-fade-up p-4 ${overdue ? 'border-l-4 !border-l-critical bg-critical/[0.08]' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
          overdue ? 'bg-critical/15 text-critical' : 'bg-primary/15 text-primary'
        }`}>
          {overdue ? <AlertTriangle size={18} /> : <Snowflake size={18} />}
        </span>
        <div>
          <p className={`text-body font-semibold ${overdue ? 'text-critical' : 'text-t1'}`}>
            {overdue ? 'Внимание: грейс-период слетает!' : 'Резерв для сохранения грейса'}
          </p>
          <p className="text-caption text-t2">
            {overdue
              ? 'Необходимо пополнить карту для продления льготного периода.'
              : 'Платёж для обновления льготного периода (карусель)'}
          </p>
        </div>
        <span className={`ml-auto tabular-nums text-heading font-bold ${overdue ? 'text-critical' : 'text-warm'}`}>
          {formatMoney(maxPayment)}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.graceItems.map((g, i) => (
          <li key={i} className="flex items-center justify-between text-caption text-t2">
            <span className="truncate">{g.name}</span>
            <span className="tabular-nums">
              {formatMoney(g.amount)}
              {g.dueDate && <span className="ml-2 text-t3">до {formatDateShort(g.dueDate)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
