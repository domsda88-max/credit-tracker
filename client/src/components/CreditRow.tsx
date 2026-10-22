import { Link } from 'react-router-dom';
import type { CreditListItem } from '../types';
import {
  CREDIT_TYPE_LABELS,
  describeDueDate,
  debtPaidPercent,
  formatDate,
  formatMoneyShort,
} from '../utils/format';

function getIcon(type: CreditListItem['type']) {
  if (type === 'CREDIT_CARD') return '💳';
  if (type === 'LOAN') return '🤝';
  if (type === 'MORTGAGE') return '🏠';
  if (type === 'INSTALLMENT') return '🧾';
  if (type === 'MICROLOAN') return '⚡';
  return '💸';
}

export function CreditRow({ credit }: { credit: CreditListItem }) {
  const percent = debtPaidPercent(credit.principal, credit.outstanding);
  const isClosed = credit.status === 'CLOSED';
  const next = credit.nextPayment;

  return (
    <Link
      to={`/credits/${credit.id}`}
      className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition active:scale-[0.99] hover:border-sky-500/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-lg">
            {getIcon(credit.type)}
          </div>
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
        </div>

        <div className="text-right">
          <p className="tabular text-lg font-semibold text-slate-100">
            {formatMoneyShort(credit.outstanding)}
          </p>
          <p className="text-xs text-slate-500">остаток</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
          style={{ width: `${percent}%` }}
        />
      </div>

      {next && !isClosed && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2 text-sm">
          <span className="text-slate-400">Ближайший платёж</span>
          <span className="text-right">
            <span className="tabular font-medium text-slate-100">{formatMoneyShort(next.amount)}</span>
            <span className="ml-2 text-xs text-slate-500">
              {formatDate(next.dueDate)} · {describeDueDate(next.dueDate)}
            </span>
          </span>
        </div>
      )}
    </Link>
  );
}
