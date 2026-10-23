import { Link } from 'react-router-dom';
import type { CreditListItem } from '../types';
import { describeDueDate, formatDate, formatMoney } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

/**
 * Красный баннер, если есть просроченные платежи. Появляется первым на дашборде:
 * главная боль пользователя — не пропустить платёж.
 */
export function OverdueAlert({ credits }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = credits
    .filter((c) => c.status === 'ACTIVE' && c.nextPayment)
    .filter((c) => new Date(c.nextPayment!.dueDate).getTime() < today.getTime())
    .sort(
      (a, b) =>
        new Date(a.nextPayment!.dueDate).getTime() - new Date(b.nextPayment!.dueDate).getTime(),
    );

  if (overdue.length === 0) return null;

  const total = overdue.reduce((acc, c) => acc + Number(c.nextPayment!.amount), 0);

  return (
    <section className="rounded-card border border-danger/40 bg-danger/10 p-4">
      <p className="font-semibold text-danger">
        ⚠️ Просрочено платежей: {overdue.length} · {formatMoney(total)}
      </p>
      <div className="mt-2 space-y-1">
        {overdue.map((c) => (
          <Link
            key={c.id}
            to={`/credits/${c.id}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-rose-200">{c.name}</span>
            <span className="shrink-0 text-xs text-danger/80">
              {formatDate(c.nextPayment!.dueDate)} · {describeDueDate(c.nextPayment!.dueDate)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
