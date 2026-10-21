import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { debtPaidPercent, formatDate, formatMoney, formatMoneyShort } from '../utils/format';

/** Человеческий срок до даты: «через 2 года 3 мес.» */
function untilLabel(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  let months =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`);
  if (rest > 0) parts.push(`${rest} мес.`);
  return parts.length ? `через ${parts.join(' ')}` : 'меньше месяца';
}

/**
 * Общая картина по всем кредитам — то, чего не хватало в отзывах конкурентов
 * (AlmostZero: «нет общего прогресса и таймлайна»). Данные — с сервера (/credits/summary).
 */
export function DebtOverview() {
  const { data } = useQuery({
    queryKey: ['credits', 'summary'],
    queryFn: () => creditsApi.summary(),
  });

  if (!data || data.activeCount === 0) return null;

  const percent = debtPaidPercent(data.principalSum, data.outstandingSum);

  return (
    <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/40 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Долг погашен на</p>
          <p className="tabular mt-1 text-4xl font-bold text-sky-300">{percent}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Остаток долга</p>
          <p className="tabular mt-1 text-xl font-semibold text-slate-100">
            {formatMoneyShort(data.outstandingSum)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Выплачено по телу</p>
          <p className="tabular font-medium text-slate-200">{formatMoney(data.paidByPrincipal)}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-500">Первоначальная сумма</p>
          <p className="tabular font-medium text-slate-200">{formatMoney(data.principalSum)}</p>
        </div>
      </div>

      {data.debtFreeDate && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-sky-500/10 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-sky-300/80">
              🎯 Свобода от долгов
            </p>
            <p className="mt-0.5 text-sm font-semibold text-sky-200">
              {formatDate(data.debtFreeDate)}
            </p>
          </div>
          <p className="text-xs text-sky-300/80">{untilLabel(data.debtFreeDate)}</p>
        </div>
      )}

      {data.overpay > 0 && (
        <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
          Если платить строго по графику, банкам уйдёт{' '}
          <span className="tabular text-amber-300">{formatMoney(data.overpay)}</span> процентов
        </p>
      )}
    </section>
  );
}
