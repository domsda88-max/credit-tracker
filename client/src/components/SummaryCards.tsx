import type { CreditListItem } from '../types';
import { formatMoney, formatMoneyShort } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

export function SummaryCards({ credits }: Props) {
  const active = credits.filter((c) => c.status === 'ACTIVE');
  const totalOutstanding = active.reduce((acc, c) => acc + Number(c.outstanding), 0);

  const withNext = active
    .filter((c) => c.nextPayment)
    .sort(
      (a, b) =>
        new Date(a.nextPayment!.dueDate).getTime() - new Date(b.nextPayment!.dueDate).getTime(),
    );
  const nearest = withNext[0]?.nextPayment ?? null;

  const today = new Date();
  const monthPayments = active.reduce((acc, c) => {
    const next = c.nextPayment;
    if (!next) return acc;
    const due = new Date(next.dueDate);
    const sameMonth = due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
    return sameMonth ? acc + Number(next.amount) : acc;
  }, 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Общий остаток</p>
        <p className="tabular mt-1 text-2xl font-semibold text-slate-100">
          {formatMoneyShort(totalOutstanding)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{active.length} активных кредитов</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Ближайший платёж</p>
        <p className="tabular mt-1 text-2xl font-semibold text-slate-100">
          {nearest ? formatMoney(nearest.amount) : '—'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {nearest
            ? `${new Date(nearest.dueDate).toLocaleDateString('ru-RU')} · ${withNext[0]?.name}`
            : 'нет предстоящих платежей'}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Платежи в этом месяце</p>
        <p className="tabular mt-1 text-2xl font-semibold text-slate-100">
          {formatMoney(monthPayments)}
        </p>
        <p className="mt-1 text-xs text-slate-500">по ближайшим платежам</p>
      </div>
    </div>
  );
}
