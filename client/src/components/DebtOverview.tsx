import { Target, Zap } from 'lucide-react';
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

/** Число месяцев человеческим языком: «2 года 3 мес.». */
function monthsLabel(months: number): string {
  if (months <= 0) return 'меньше месяца';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`);
  if (rest > 0) parts.push(`${rest} мес.`);
  return parts.join(' ');
}

/**
 * Общая картина по всем кредитам: прогресс погашения, дата свободы и прогноз
 * ускорения. Данные — с сервера (/credits/summary).
 */
export function DebtOverview() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
  });

  if (!data || data.activeCount === 0) return null;

  const percent = debtPaidPercent(data.principalSum, data.outstandingSum);

  return (
    <section className="card animate-fade-up p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="section-title">Долг погашен на</p>
          <p className="tabular mt-1 text-hero font-extrabold text-primary">{percent}%</p>
        </div>
        <div className="text-right">
          <p className="section-title">Остаток долга</p>
          <p className="tabular mt-1 text-heading font-semibold text-t1">
            {formatMoneyShort(data.outstandingSum)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-700 ease-app"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-caption">
        <div>
          <p className="text-t3">Выплачено по телу</p>
          <p className="tabular mt-0.5 font-semibold text-t1">{formatMoney(data.paidByPrincipal)}</p>
        </div>
        <div className="text-right">
          <p className="text-t3">Первоначальная сумма</p>
          <p className="tabular mt-0.5 font-semibold text-t1">{formatMoney(data.principalSum)}</p>
        </div>
      </div>

      {data.debtFreeDate && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-control bg-gradient-to-r from-primary/10 to-success/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-primary/15 text-primary">
              <Target size={18} />
            </span>
            <div>
              <p className="text-micro uppercase tracking-[0.04em] text-t2">Свобода от долгов</p>
              <p className="tabular text-heading font-bold text-t1">
                {formatDate(data.debtFreeDate)}
              </p>
            </div>
          </div>
          <p className="text-caption text-t2">{untilLabel(data.debtFreeDate)}</p>
        </div>
      )}

      {data.accelerator && data.accelerator.savedMonths > 0 && (
        <div className="mt-3 rounded-control border border-success/20 bg-success/[0.07] px-4 py-3">
          <p className="flex items-center gap-1.5 text-micro uppercase tracking-[0.04em] text-success">
            <Zap size={14} />
            Ускорь свободу
          </p>
          <p className="mt-1.5 text-caption leading-relaxed text-t1">
            Если вносить{' '}
            <span className="tabular font-semibold text-success">
              +{formatMoney(data.accelerator.extraPerMonth)}
            </span>{' '}
            каждый месяц в самый дорогой долг (
            <span className="font-medium text-success">{data.accelerator.targetName}</span>), ты
            освободишься{' '}
            <span className="font-semibold text-success">
              через {monthsLabel(data.accelerator.acceleratedMonths)}
            </span>{' '}
            вместо {monthsLabel(data.accelerator.baselineMonths)}.
          </p>
          <p className="mt-1 text-micro text-success/80">
            Экономия: {monthsLabel(data.accelerator.savedMonths)}
          </p>
        </div>
      )}

      {data.overpay > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-micro text-t3">
          Если платить строго по графику, банкам уйдёт{' '}
          <span className="tabular font-medium text-warning">{formatMoney(data.overpay)}</span>{' '}
          процентов
        </p>
      )}

      {data.paidLast12Months > 0 && (
        <p className="mt-2 text-micro text-t3">
          За последние 12 месяцев внесено{' '}
          <span className="tabular font-medium text-t2">{formatMoney(data.paidLast12Months)}</span>
          {data.paymentsLast12Months > 0 && <> · {data.paymentsLast12Months} платежей</>}
        </p>
      )}
    </section>
  );
}
