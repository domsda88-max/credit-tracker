import { Link } from 'react-router-dom';
import type { CreditListItem } from '../types';
import { describeDueDate, formatDate, formatMoney } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

interface Item {
  creditId: string;
  creditName: string;
  dueDate: string;
  amount: number;
  /** true — платёж был в прошлом (просрочен или уже должен был пройти). */
  overdue: boolean;
}

/**
 * Ближайшие платежи по всем кредитам одним списком —
 * чтобы видеть «что и когда платить», не открывая каждый кредит.
 */
export function UpcomingPayments({ credits }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: Item[] = credits
    .filter((c) => c.status === 'ACTIVE' && c.nextPayment)
    .map((c) => ({
      creditId: c.id,
      creditName: c.name,
      dueDate: c.nextPayment!.dueDate,
      amount: Number(c.nextPayment!.amount),
      overdue: new Date(c.nextPayment!.dueDate).getTime() < today.getTime(),
    }))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Ближайшие платежи
      </h2>
      <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {items.map((item) => (
          <Link
            key={item.creditId}
            to={`/credits/${item.creditId}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition active:bg-slate-800/60"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{item.creditName}</p>
              <p className="text-xs text-slate-500">
                {formatDate(item.dueDate)} ·{' '}
                <span className={item.overdue ? 'text-rose-400' : 'text-slate-500'}>
                  {describeDueDate(item.dueDate)}
                </span>
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold text-slate-100">
              {formatMoney(item.amount)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
