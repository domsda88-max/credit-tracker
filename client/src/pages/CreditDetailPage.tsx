import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { extractErrorMessage } from '../api/client';
import { creditsApi } from '../api/credits';
import { paymentsApi } from '../api/payments';
import { StatusBadge } from '../components/StatusBadge';
import { BalanceChart } from '../components/BalanceChart';
import { EditCreditForm } from '../components/EditCreditForm';
import type { EarlyPreview, PaymentEvent } from '../types';
import {
  CREDIT_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  debtPaidPercent,
  formatDate,
  formatMoney,
} from '../utils/format';

const earlySchema = z.object({
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  mode: z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']),
});

type EarlyFormValues = z.input<typeof earlySchema>;

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500';

const EVENT_LABELS: Record<PaymentEvent['kind'], string> = {
  SCHEDULED: 'Платёж по графику',
  EARLY_PARTIAL: 'Досрочное частичное',
  EARLY_FULL: 'Досрочное полное',
  MIN_PAYMENT: 'Минимальный платёж',
};

export function CreditDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showAllPaid, setShowAllPaid] = useState(false);
  const [editing, setEditing] = useState(false);
  /** id платежа, для которого открыта форма фактической оплаты (сумма/дата). */
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data: credit, isLoading, error: loadError } = useQuery({
    queryKey: ['credit', id],
    queryFn: () => creditsApi.getById(id),
    enabled: Boolean(id),
  });

  const { register, handleSubmit, reset, formState, watch } = useForm<EarlyFormValues>({
    resolver: zodResolver(earlySchema),
    defaultValues: { mode: 'REDUCE_PAYMENT' },
  });

  const [preview, setPreview] = useState<EarlyPreview | null>(null);
  const watchAmount = watch('amount');
  const watchMode = watch('mode');

  // Живой предпросмотр: считаем экономию, когда пользователь ввёл сумму.
  useEffect(() => {
    const amount = Number(watchAmount);
    if (!id || !Number.isFinite(amount) || amount <= 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      paymentsApi
        .previewEarlyRepayment(id, { amount, mode: watchMode })
        .then((data) => {
          if (!cancelled) setPreview(data);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id, watchAmount, watchMode]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['credit', id] });
    await queryClient.invalidateQueries({ queryKey: ['credits'] });
  };

  const payMutation = useMutation({
    mutationFn: (vars: { installmentId: string; amount?: number; paidAt?: string }) =>
      paymentsApi.payInstallment(vars.installmentId, { amount: vars.amount, paidAt: vars.paidAt }),
    onSuccess: async () => {
      setPayingId(null);
      await invalidate();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const earlyMutation = useMutation({
    mutationFn: (values: EarlyFormValues) => {
      const parsed = earlySchema.parse(values);
      return paymentsApi.earlyRepayment(id, parsed);
    },
    onSuccess: async () => {
      reset({ amount: undefined as unknown as number, mode: 'REDUCE_PAYMENT' });
      await invalidate();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const freezeMutation = useMutation({
    mutationFn: (frozen: boolean) => creditsApi.toggleFreeze(id, frozen),
    onSuccess: invalidate,
    onError: (err) => setError(extractErrorMessage(err)),
  });

  if (isLoading) return <p className="text-sm text-slate-500">Загружаю кредит…</p>;
  if (loadError || !credit) {
    return (
      <div>
        <p className="text-sm text-rose-400">
          Не удалось загрузить кредит: {(loadError as Error | null)?.message ?? 'не найден'}
        </p>
        <Link to="/" className="mt-3 inline-block text-sm text-sky-400">
          ← Назад к дашборду
        </Link>
      </div>
    );
  }

  const percent = debtPaidPercent(credit.principal, credit.outstanding);
  const principalPaid = Math.max(0, Number(credit.principal) - Number(credit.outstanding));
  const interestPaid = Math.max(0, Number(credit.totalPaid) - principalPaid);
  const pending = credit.schedule.filter((item) => item.status !== 'PAID');
  const paid = credit.schedule.filter((item) => item.status === 'PAID');
  const visible = showAllPaid ? credit.schedule : pending;
  const collapsedCount = showAllPaid ? 0 : paid.length;
  return (
    <div className="space-y-4">
      <Link to="/" className="inline-block text-sm text-slate-500 hover:text-slate-300">
        ← Дашборд
      </Link>

      <header className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-sky-500/10 via-transparent to-emerald-400/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-100">{credit.name}</h1>
              {credit.frozen && <span title="Цикл заморозки">🧊</span>}
              {credit.status === 'CLOSED' && <span>✅</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {CREDIT_TYPE_LABELS[credit.type]}
              {credit.type !== 'LOAN' && (
                <>
                  {' · '}
                  {PAYMENT_TYPE_LABELS[credit.paymentType]} · {Number(credit.annualRate)}%
                </>
              )}
              {credit.type === 'LOAN' && <> · {Number(credit.annualRate)}%</>}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-slate-300 transition hover:border-sky-500/50"
            >
              {editing ? 'Закрыть' : 'Изменить'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Остаток долга</p>
            <p className="tabular text-lg font-semibold text-slate-100">{formatMoney(credit.outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Первоначально</p>
            <p className="tabular text-lg font-semibold text-slate-100">{formatMoney(credit.principal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Выплачено</p>
            <p className="tabular text-lg font-semibold text-emerald-300">{formatMoney(credit.totalPaid)}</p>
          </div>
          {credit.type !== 'LOAN' ? (
            <div>
              <p className="text-xs text-slate-500">Срок / день платежа</p>
              <p className="font-semibold text-slate-100">
                {credit.termMonths} мес.
                {credit.paymentDay ? ` · ${credit.paymentDay}-е` : ''}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500">Ставка</p>
              <p className="font-semibold text-slate-100">{Number(credit.annualRate)}%</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm('Удалить кредит и весь график платежей?')) return;
              try {
                await creditsApi.remove(id);
                await queryClient.invalidateQueries({ queryKey: ['credits'] });
                window.location.href = '/';
              } catch (err) {
                setError(extractErrorMessage(err));
              }
            }}
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
          >
            Удалить кредит
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Остаток долга</p>
            <p className="tabular font-semibold text-slate-100">{formatMoney(credit.outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Первоначально</p>
            <p className="tabular font-semibold text-slate-100">{formatMoney(credit.principal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Выплачено</p>
            <p className="tabular font-semibold text-emerald-300">{formatMoney(credit.totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Срок / день платежа</p>
            <p className="font-semibold text-slate-100">
              {credit.termMonths} мес.
              {credit.paymentDay ? ` · ${credit.paymentDay}-е` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-slate-400">
            Долг погашен на <span className="font-medium text-slate-200">{percent}%</span>
            {' — '}
            <span className="tabular text-slate-300">{formatMoney(principalPaid)}</span> из{' '}
            <span className="tabular text-slate-300">{formatMoney(credit.principal)}</span>
          </p>
          <p className="text-xs text-slate-500">
            Всего выплачено <span className="tabular text-slate-400">{formatMoney(credit.totalPaid)}</span>
            {' '}(тело {formatMoney(principalPaid)} + проценты {formatMoney(interestPaid)})
          </p>
          <p className="text-xs text-slate-500">
            Остаток долга <span className="tabular text-slate-300">{formatMoney(credit.outstanding)}</span>
            {' '}(<span className="tabular">{100 - percent}%</span> от первоначальной суммы)
          </p>
        </div>

        {credit.frozen && credit.nextFreezeCheckAt && (
          <p className="mt-3 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
            🧊 Цикл заморозки до {formatDate(credit.nextFreezeCheckAt)}
            {credit.freezeCycleDays ? ` (каждые ${credit.freezeCycleDays} дн.)` : ''}
          </p>
        )}
      </header>

      {editing && <EditCreditForm credit={credit} onClose={() => setEditing(false)} />}

      {!editing && (
        <BalanceChart
          schedule={credit.schedule}
          principal={credit.principal}
          outstanding={credit.outstanding}
        />
      )}

      {credit.status === 'ACTIVE' && credit.type !== 'LOAN' && (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h2 className="font-medium text-slate-100">Досрочное погашение</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            График пересчитается автоматически: {credit.prepaymentMode === 'REDUCE_TERM' ? 'сократится срок' : 'уменьшится платёж'}
          </p>

          <form
            onSubmit={handleSubmit((values) => earlyMutation.mutate(values))}
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="block sm:w-40">
              <span className="text-sm text-slate-400">Сумма, ₽</span>
              <input type="number" step="0.01" {...register('amount')} className={inputClass} />
              {formState.errors.amount && (
                <p className="mt-1 text-xs text-rose-400">{formState.errors.amount.message}</p>
              )}
            </label>

            <label className="block sm:w-48">
              <span className="text-sm text-slate-400">Режим</span>
              <select {...register('mode')} className={inputClass}>
                <option value="REDUCE_PAYMENT">Уменьшить платёж</option>
                <option value="REDUCE_TERM">Сократить срок</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={earlyMutation.isPending}
              className="rounded-xl bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {earlyMutation.isPending ? 'Пересчитываю…' : 'Внести'}
            </button>
          </form>

          {preview && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
              {preview.isFull ? (
                <p className="font-medium text-emerald-300">
                  🎉 Полное закрытие кредита: сэкономите{' '}
                  <span className="tabular">{formatMoney(preview.interestSaved)}</span> процентов
                  {' '}и <span className="font-semibold">{preview.monthSaved} мес.</span>
                </p>
              ) : (
                <>
                  <p className="font-medium text-emerald-300">
                    Экономия: <span className="tabular">{formatMoney(preview.interestSaved)}</span>{' '}
                    процентов
                    {preview.monthSaved > 0 && (
                      <> и <span className="font-semibold">{preview.monthSaved} мес.</span> срока</>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-emerald-200/70">
                    {watchMode === 'REDUCE_TERM' ? (
                      <>Останется платежей: {preview.monthsAfter} · платёж {formatMoney(preview.paymentAfter)}</>
                    ) : (
                      <>Платёж уменьшится с {formatMoney(preview.paymentBefore)} до {formatMoney(preview.paymentAfter)}</>
                    )}
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {credit.type !== 'LOAN' && (
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium text-slate-100">
            График платежей{' '}
            {pending.length > 0 && <span className="text-slate-500">· к оплате {pending.length}</span>}
          </h2>
          {paid.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPaid((v) => !v)}
              className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/50"
            >
              {showAllPaid ? 'Свернуть оплаченные' : `Показать оплаченные (${paid.length})`}
            </button>
          )}
        </div>

        {collapsedCount > 0 && (
          <p className="mt-3 rounded-xl bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
            {collapsedCount} прошедших платежей уже учтены как оплаченные. Нажмите «Показать оплаченные», чтобы посмотреть.
          </p>
        )}

        <div className="mt-3 divide-y divide-slate-800">
          {visible.map((item) => {
            const expanded = payingId === item.id;
            const today = new Date().toISOString().slice(0, 10);
            return (
              <div key={item.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200">{formatDate(item.dueDate)}</p>
                    <p className="text-xs text-slate-500">
                      тело {formatMoney(item.principalPart)} · проценты {formatMoney(item.interestPart)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-sm font-medium text-slate-100">
                      {formatMoney(item.amount)}
                    </span>
                    {item.status === 'PAID' ? (
                      <StatusBadge status="PAID" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPayingId(expanded ? null : item.id)}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-sky-400"
                      >
                        {expanded ? 'Отмена' : 'Я оплатил'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <form
                    className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const amountRaw = (form.elements.namedItem('amount') as HTMLInputElement).value;
                      const dateRaw = (form.elements.namedItem('paidAt') as HTMLInputElement).value;
                      const amount = amountRaw ? Number(amountRaw) : undefined;
                      if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
                        setError('Сумма должна быть больше 0');
                        return;
                      }
                      payMutation.mutate({
                        installmentId: item.id,
                        amount,
                        paidAt: dateRaw ? new Date(dateRaw).toISOString() : undefined,
                      });
                    }}
                  >
                    <p className="text-xs text-slate-400">
                      Фактическая оплата. Оставьте как есть, если заплатили вовремя и всю сумму —
                      тогда тело долга уменьшится на {formatMoney(item.principalPart)}.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Сумма, ₽</span>
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={Number(item.amount)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Дата платежа</span>
                        <input
                          name="paidAt"
                          type="date"
                          defaultValue={today}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={payMutation.isPending}
                      className="mt-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                    >
                      {payMutation.isPending ? 'Записываю…' : 'Подтвердить оплату'}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}

      {credit.events.length > 0 && (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h2 className="font-medium text-slate-100">История платежей</h2>
          <div className="mt-3 space-y-2">
            {credit.events.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {formatDate(event.paidAt)} · {EVENT_LABELS[event.kind]}
                </span>
                <span className="tabular text-slate-100">{formatMoney(event.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
