import type { CreditListItem } from '../types';
import { formatMoneyShort } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

/**
 * Подсказка, какой кредит гасить досрочно первым.
 * Две классические стратегии (их продвигают Debt Payoff Planner, TinyDebt, YNAB):
 *   🏔️ Лавина — сначала самый дорогой по ставке (максимум экономии процентов);
 *   ☃️ Снежный ком — сначала самый маленький по остатку (быстрые победы, мотивация).
 */
export function PayoffStrategy({ credits }: Props) {
  const active = credits
    .filter((c) => c.status === 'ACTIVE' && Number(c.outstanding) > 0)
    .map((c) => ({ ...c, rate: Number(c.annualRate), left: Number(c.outstanding) }));

  if (active.length < 2) return null;

  const avalanche = [...active].sort((a, b) => b.rate - a.rate)[0];
  const snowball = [...active].sort((a, b) => a.left - b.left)[0];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Что гасить первым
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-300/80">🏔️ Лавина · меньше процентов</p>
          <p className="mt-1 truncate font-semibold text-slate-100">{avalanche.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            самая высокая ставка — {avalanche.rate}% · остаток {formatMoneyShort(avalanche.left)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Досрочка сюда экономит больше всего денег
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-300/80">
            ☃️ Снежный ком · быстрые победы
          </p>
          <p className="mt-1 truncate font-semibold text-slate-100">{snowball.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            самый маленький остаток — {formatMoneyShort(snowball.left)} · {snowball.rate}%
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Закроете быстрее — и это придаёт сил
          </p>
        </div>
      </div>
    </section>
  );
}
