import { Target, Clock, Zap, TrendingDown, FileText } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { creditsApi } from '../api/credits';
import { debtPaidPercent, formatDate, formatMoney, formatMoneyShort } from '../utils/format';
import type { CreditListItem } from '../types';
import { CREDIT_TYPE_LABELS } from '../utils/format';

function monthsLabel(months: number): string {
  if (months <= 0) return 'меньше месяца';
  const totalDays = Math.round(months * 30.44);
  let years = Math.floor(totalDays / 365);
  const restDays = totalDays % 365;
  let restMonths = Math.floor(restDays / 30.44);
  let days = Math.round(restDays % 30.44);
  if (days > 15) { restMonths += 1; days = 0; }
  if (restMonths === 12) { years += 1; restMonths = 0; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`);
  if (restMonths > 0) parts.push(`${restMonths} мес.`);
  if (days > 0 && years === 0) parts.push(`${days} дн.`);
  return parts.join(' ') || '0 дн.';
}

export function FreedomPage() {
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
    placeholderData: keepPreviousData,
  });
  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    placeholderData: keepPreviousData,
  });

  const activeDebts = useMemo(() => {
    if (!credits) return [];
    return (credits as CreditListItem[]).filter((c) => c.status === 'ACTIVE' && Number(c.outstanding) > 0);
  }, [credits]);

  const totalOutstanding = useMemo(() => activeDebts.reduce((sum, c) => sum + Number(c.outstanding), 0), [activeDebts]);
  const totalPrincipal = useMemo(() => activeDebts.reduce((sum, c) => sum + Number(c.principal), 0), [activeDebts]);
  const totalPaid = useMemo(() => activeDebts.reduce((sum, c) => sum + Number(c.totalPaid), 0), [activeDebts]);

  const percent = totalPrincipal > 0 ? Math.round(((totalPrincipal - totalOutstanding) / totalPrincipal) * 100) : 0;

  const baselineMonths = useMemo(() => {
    if (!summary?.debtFreeDate) return 0;
    const target = new Date(summary.debtFreeDate);
    const now = new Date();
    return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
  }, [summary?.debtFreeDate]);

  if (!summary || summary.activeCount === 0) {
    return (
      <section className="card animate-fade-up p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface2 mb-4">
          <Target size={24} className="text-primary-fg" />
        </div>
        <h2 className="text-heading font-semibold text-t1">У вас нет активных долгов</h2>
        <p className="mt-2 text-sm text-t3 text-center">
          Все кредиты погашены — финансовая свобода достигнута!
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-up">
      <header className="card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="section-title">Моя свобода от долгов</p>
            <p className="mt-0.5 text-sm text-t3">
              Общий прогресс погашения всех активных долгов
            </p>
          </div>
          <div className="text-right">
            <p className="tabular text-hero font-extrabold text-primary-fg">{percent}%</p>
            <p className="text-micro text-t3">погашено от первоначальной суммы</p>
          </div>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-success transition-[width] duration-800 ease-app"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-4 text-caption text-t3">
          <div>
            <p className="text-micro uppercase tracking-[0.04em]">Первоначальный долг</p>
            <p className="tabular mt-0.5 text-t1">{formatMoney(totalPrincipal)}</p>
          </div>
          <div>
            <p className="text-micro uppercase tracking-[0.04em]">Остаток долга</p>
            <p className="tabular mt-0.5 font-semibold text-t1">{formatMoney(totalOutstanding)}</p>
          </div>
          <div>
            <p className="text-micro uppercase tracking-[0.04em]">Выплачено</p>
            <p className="tabular mt-0.5 text-success-fg">{formatMoney(totalPaid)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const lines = [
                'Кредит Tracker — отчёт по долгам',
                `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
                '',
                `Первоначальный долг: ${formatMoney(totalPrincipal)}`,
                `Остаток долга: ${formatMoney(totalOutstanding)}`,
                `Выплачено: ${formatMoney(totalPaid)}`,
                `Прогресс погашения: ${percent}%`,
                summary.debtFreeDate ? `Планируемая дата свободы: ${formatDate(summary.debtFreeDate)}` : '',
                '',
                'Детали по кредитам:',
              ];
              activeDebts.forEach((c) => {
                const p = debtPaidPercent(c.principal, c.outstanding);
                lines.push(
                  `• ${c.name} (${CREDIT_TYPE_LABELS[c.type as keyof typeof CREDIT_TYPE_LABELS]}): остаток ${formatMoney(Number(c.outstanding))}, закрыто ${p}%`,
                );
              });
              const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `credit-report-${new Date().toISOString().slice(0, 10)}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 rounded-control border border-line px-4 py-2.5 text-sm text-t2 transition hover:border-primary/50"
          >
            <FileText size={16} className="inline-block" /> Экспорт отчёта
          </button>
        </div>
      </header>

      {summary.debtFreeDate && (
        <section className="card p-6 border border-success/20 bg-success/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-primary/15 text-primary-fg">
                <Clock size={18} />
              </span>
              <div>
                <p className="text-micro uppercase tracking-[0.04em] text-t2">Свобода от долгов</p>
                <p className="tabular text-heading font-bold text-t1">{formatDate(summary.debtFreeDate)}</p>
              </div>
            </div>
            <p className="text-caption text-t2">{untilLabel(summary.debtFreeDate)}</p>
          </div>
          <p className="mt-3 text-xs text-t3">
            Дата, когда по текущему графику все активные кредиты будут полностью погашены.
            Досрочные платежи сократят этот срок.
          </p>
        </section>
      )}

      <section className="card p-6">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h2 className="text-heading font-semibold text-t1">Ваши активные долги</h2>
          <span className="text-micro text-t3">{activeDebts.length} кредит(ов)</span>
        </div>
        <div className="space-y-3">
          {activeDebts.map((c) => {
            const p = debtPaidPercent(c.principal, c.outstanding);
            return (
              <div key={c.id} className="flex items-center justify-between gap-4 p-3 rounded-control border border-line bg-surface">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary/12 text-primary-fg">
                    <Zap size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-t1">{c.name}</p>
                    <p className="text-xs text-t3">{CREDIT_TYPE_LABELS[c.type as keyof typeof CREDIT_TYPE_LABELS]}</p>
                  </div>
                </div>
                <div className="flex-1 max-w-[200px] h-1.5 overflow-hidden rounded-full bg-surface2 mx-4">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-500"
                    style={{ width: `${p}%` }}
                  />
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="tabular text-sm font-semibold text-t1">{formatMoneyShort(Number(c.outstanding))}</p>
                  <p className="text-[10px] text-t3">{p}% закрыто</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-6 border border-warning/20 bg-warning/5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-warning/15 text-warning-fg">
            <TrendingDown size={18} />
          </span>
          <h2 className="text-heading font-semibold text-t1">Что влияет на срок</h2>
        </div>
        <p className="text-sm text-t3 mb-4">
          Каждый досрочный платеж сокращает срок кредита и экономит проценты. Используйте
          кнопку «Досрочное погашение» на странице любого кредита.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-4 rounded-control border border-line bg-surface">
            <p className="text-micro uppercase tracking-[0.04em] text-t3">Срок по графику</p>
            <p className="tabular mt-0.5 text-t1">{monthsLabel(baselineMonths)}</p>
          </div>
          <div className="p-4 rounded-control border border-success/20 bg-success/5">
            <p className="text-micro uppercase tracking-[0.04em] text-success-fg">Потенциальная экономия</p>
            <p className="tabular mt-0.5 font-semibold text-success-fg">
              {formatMoneyShort(summary.overpay)} процентов
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

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
