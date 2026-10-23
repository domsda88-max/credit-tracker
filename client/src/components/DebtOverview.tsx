import { Target, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { debtPaidPercent, formatDate, formatMoney, formatMoneyShort } from '../utils/format';
import { simulateAccelerator } from '../utils/finance/accelerator';
import type { CreditListItem } from '../types';

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

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function DebtOverview() {
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
  });
  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
  });

  const [extra, setExtra] = useState(10000);
  const activeDebtsExist = useMemo(() => {
    if (!credits) return false;
    return (credits as CreditListItem[]).some((c) => c.status === 'ACTIVE' && Number(c.outstanding) > 0);
  }, [credits]);

  const baselineMonths = useMemo(() => {
    if (!summary?.debtFreeDate) return 0;
    return Math.max(0, monthsBetween(new Date(), new Date(summary.debtFreeDate)));
  }, [summary?.debtFreeDate]);

  const lastAccel = useRef<ReturnType<typeof simulateAccelerator>>(null);
  const accelerator = useMemo(() => {
    if (!credits) return lastAccel.current;
    const active = (credits as CreditListItem[]).filter((c) => c.status === 'ACTIVE');
    const debts = active
      .map((c) => {
        const balance = Math.max(0, Number(c.outstanding));
        if (balance <= 0) return null;
        const next = c.nextPayment;
        const isFreezeCycle = c.frozen && c.freezeCycleDays !== null;
        const minPayment = isFreezeCycle
          ? 0
          : next
            ? Number(next.amount)
            : Math.max(balance * 0.03, 0);
        return {
          id: c.id,
          name: c.name,
          annualRate: isFreezeCycle ? 0 : Number(c.annualRate),
          balance,
          minPayment,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
    const res = simulateAccelerator({ extraPerMonth: extra, baselineMonths, debts });
    if (res) lastAccel.current = res;
    return res ?? lastAccel.current;
  }, [credits, extra, baselineMonths]);

  if (!summary || summary.activeCount === 0) return null;

  const percent = debtPaidPercent(summary.principalSum, summary.outstandingSum);

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
            {formatMoneyShort(summary.outstandingSum)}
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
          <p className="tabular mt-0.5 font-semibold text-t1">{formatMoney(summary.paidByPrincipal)}</p>
        </div>
        <div className="text-right">
          <p className="text-t3">Первоначальная сумма</p>
          <p className="tabular mt-0.5 font-semibold text-t1">{formatMoney(summary.principalSum)}</p>
        </div>
      </div>

      {summary.debtFreeDate && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-control bg-gradient-to-r from-primary/10 to-success/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-primary/15 text-primary">
              <Target size={18} />
            </span>
            <div>
              <p className="text-micro uppercase tracking-[0.04em] text-t2">Свобода от долгов</p>
              <p className="tabular text-heading font-bold text-t1">{formatDate(summary.debtFreeDate)}</p>
            </div>
          </div>
          <p className="text-caption text-t2">{untilLabel(summary.debtFreeDate)}</p>
        </div>
      )}

      {/* Accelerator block temporarily removed for binary search */}

      {summary.overpay > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-micro text-t3">
          Если платить строго по графику, банкам уйдёт{' '}
          <span className="tabular font-medium text-warning">{formatMoney(summary.overpay)}</span>{' '}
          процентов
        </p>
      )}

      {summary.paidLast12Months > 0 && (
        <p className="mt-2 text-micro text-t3">
          За последние 12 месяцев внесено{' '}
          <span className="tabular font-medium text-t2">{formatMoney(summary.paidLast12Months)}</span>
          {summary.paymentsLast12Months > 0 && <> · {summary.paymentsLast12Months} платежей</>}
        </p>
      )}
    </section>
  );
}
