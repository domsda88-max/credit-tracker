import type { CreditListItem } from '../types';
import { formatMoneyShort } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

/**
 * Подсказка, какой долг гасить досрочно первым.
 * Две классические стратегии (их продвигают Debt Payoff Planner, TinyDebt, YNAB):
 *   🏔️ Лавина — сначала самый дорогой по ставке (максимум экономии процентов);
 *   ☃️ Снежный ком — сначала самый маленький по остатку (быстрые победы, мотивация).
 *
 * Важно: для кредитных карт «остаток» — это возобновляемый долг (льготный период),
 * а не кредит, который «закрывают» досрочкой. Поэтому снежный ком выбирает
 * наименьший остаток среди закрываемых долгов (кредиты/рассрочки/ипотека),
 * а по картам даёт отдельную рекомендацию — гасить самую дорогую.
 */
export function PayoffStrategy({ credits }: Props) {
  const active = credits
    .filter((c) => c.status === 'ACTIVE' && Number(c.outstanding) > 0)
    .map((c) => ({ ...c, rate: Number(c.annualRate), left: Number(c.outstanding) }));

  if (active.length < 2) return null;

  const avalanche = [...active].sort((a, b) => b.rate - a.rate)[0];

  // Снежный ком — только среди долгов, которые реально можно закрыть досрочно.
  const closable = active.filter((c) => c.type !== 'CREDIT_CARD');
  const snowball = closable.length > 0
    ? [...closable].sort((a, b) => a.left - b.left)[0]
    : null;

  // Для карт: если карт несколько — подскажем самую дорогую по ставке.
  const cards = active.filter((c) => c.type === 'CREDIT_CARD');
  const priciestCard = cards.length > 0 ? [...cards].sort((a, b) => b.rate - a.rate)[0] : null;

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

        {snowball ? (
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
        ) : (
          priciestCard && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-300/80">
                🧊 Кредитки · меньший долг по картам
              </p>
              <p className="mt-1 truncate font-semibold text-slate-100">{priciestCard.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                самая дорогая карта — {priciestCard.rate}% · задолженность{' '}
                {formatMoneyShort(priciestCard.left)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                По картам «закрыть» нельзя — гасите задолженность, чтобы не платить проценты
              </p>
            </div>
          )
        )}
      </div>

      {snowball && priciestCard && (
        <p className="rounded-xl bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
          🧊 По кредиткам долг возобновляемый: «закрыть» их досрочкой нельзя, но самую дорогую
          стоит гасить в первую очередь — <span className="text-slate-200">{priciestCard.name}</span>{' '}
          ({priciestCard.rate}%).
        </p>
      )}
    </section>
  );
}
