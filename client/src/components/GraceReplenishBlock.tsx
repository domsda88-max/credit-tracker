import { AlertTriangle, Snowflake } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { startOfUTCDay } from '../utils/date';
import { formatMoney, formatDateShort } from '../utils/format';

export function GraceReplenishBlock() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
  });

  if (!data || !data.graceItems?.length) return null;

  // Даты приходят из UTC-графика: в день обновления грейса ещё не просрочка.
  const today = startOfUTCDay();
  const overdue = data.graceItems.some(
    (g) => g.dueDate && new Date(g.dueDate).getTime() < today.getTime(),
  );

  // В заголовке — весь резерв по всем картам, а не максимум одной карты.
  const reserveTotal =
    data.graceReplenishTotal ??
    data.graceItems.reduce((sum, g) => sum + Number(g.amount ?? 0), 0);

  return (
    <section
      className={`card animate-fade-up p-4 ${
        overdue ? 'border-critical/40 bg-critical/10' : 'border-grace/30 bg-grace-soft'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-chip ${
            overdue ? 'bg-critical/15 text-critical-fg' : 'bg-grace/15 text-grace-fg'
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
          {formatMoney(reserveTotal)}
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
