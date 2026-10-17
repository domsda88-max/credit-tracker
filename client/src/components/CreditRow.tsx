import { Link } from 'react-router-dom';
import type { CreditListItem } from '../types';
import {
  CREDIT_TYPE_LABELS,
  describeDueDate,
  formatDate,
  formatMoney,
  formatMoneyShort,
  paidPercent,
} from '../utils/format';

export function CreditRow({ credit }: { credit: CreditListItem }) {
  const percent = paidPercent(credit.totalPaid, credit.principal);
  const isClosed = credit.status === 'CLOSED';
  const next = credit.nextPayment;

  return (
    <Link
      to={`/credits/${credit.id}`}
      className="block rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-sky-500/40 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-100">{credit.name}</h3>
            {credit.frozen && <span title="Цикл заморозки">🧊</span>}
            {isClosed && <span title="Кредит закрыт">✅</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {CREDIT_TYPE_LABELS[credit.type]} · {Number(credit.annualRate)}% годовых
          </p>
        </div>

        <div className="text-right">
          <p className="tabular text-lg font-semibold text-slate-100">
            {formatMoneyShort(credit.outstanding)}
          </p>
          <p className="text-xs text-slate-500">остаток долга</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">Погашено {percent}%</p>

      {next && !isClosed && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2 text-sm">
          <span className="text-slate-400">Ближайший платёж</span>
          <span className="text-right">
            <span className="tabular font-medium text-slate-100">{formatMoney(next.amount)}</span>
            <span className="ml-2 text-xs text-slate-500">
              {formatDate(next.dueDate)} · {describeDueDate(next.dueDate)}
            </span>
          </span>
        </div>
      )}
    </Link>
  );
}
