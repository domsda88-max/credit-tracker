import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { extractErrorMessage } from '../api/client';
import { creditsApi } from '../api/credits';
import { paymentsApi } from '../api/payments';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonCard } from '../components/Skeleton';
import { SegmentedControl } from '../components/SegmentedControl';
import { BalanceChart } from '../components/BalanceChart';
import { EditCreditForm } from '../components/EditCreditForm';
import { useToast } from '../components/Toast';
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
  mode: z.enum(['REDUCE_TERM']).optional().default('REDUCE_TERM'),
  date: z.string().min(1, 'Укажите дату внесения'),
});

type EarlyFormValues = z.input<typeof earlySchema>;

const inputClass =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none transition focus:border-primary';

const EVENT_LABELS: Record<PaymentEvent['kind'], string> = {
  SCHEDULED: 'По графику',
  EARLY_PARTIAL: 'Досрочно',
  EARLY_FULL: 'Закрытие кредита',
  MIN_PAYMENT: 'Минимальный платёж',
};

export function CreditDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, reset, formState, watch, setValue } = useForm<EarlyFormValues>({
    resolver: zodResolver(earlySchema),
    defaultValues: { mode: 'REDUCE_TERM', date: todayStr },
  });

  const [preview, setPreview] = useState<EarlyPreview | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const submitting = useRef(false);
  const watchAmount = watch('amount');
  const watchMode = watch('mode');
  const watchDate = watch('date');

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
        .previewEarlyRepayment(id, { amount, mode: 'REDUCE_TERM' })
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
      toast.show('Платёж отмечен');
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const earlyMutation = useMutation({
    mutationFn: (values: EarlyFormValues) => {
      const parsed = earlySchema.parse(values);
      return paymentsApi.earlyRepayment(id, { amount: parsed.amount, mode: parsed.mode, date: parsed.date } as any);
    },
    onSuccess: async () => {
      reset({ amount: undefined as unknown as number, mode: 'REDUCE_TERM', date: todayStr });
      setPreview(null);
      await invalidate();
      toast.show('Досрочное погашение внесено');
      navigator.vibrate?.([30, 40, 30]);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const freezeMutation = useMutation({
    mutationFn: (frozen: boolean) => creditsApi.toggleFreeze(id, frozen),
    onSuccess: async (_data, frozen) => {
      await invalidate();
      toast.show(frozen ? 'Кредит заморожен' : 'Кредит разморожен');
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  if (isLoading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>;
  if (loadError || !credit) {
    return (
      <div>
        <p className="text-sm text-danger">
          Не удалось загрузить кредит: {(loadError as Error | null)?.message ?? 'не найден'}
        </p>
        <Link to="/" className="mt-3 inline-block text-sm text-primary">
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
  const earlyKeys = new Set(
    (credit.events || [])
      .filter((e) => e.kind === 'EARLY_PARTIAL' || e.kind === 'EARLY_FULL')
      .map((e) => `${new Date(e.paidAt).toISOString().slice(0, 10)}|${Number(e.amount)}`),
  );
  const visible = showAllPaid ? credit.schedule : pending;
  const collapsedCount = showAllPaid ? 0 : paid.length;
  return (
    <div className="min-h-0 w-full overflow-x-hidden pb-24 [-webkit-overflow-scrolling:touch]">
      <div className="space-y-4">
      <Link to="/" className="inline-block text-sm text-t3 hover:text-t2">
        ← Дашборд
      </Link>

      <header className="rounded-card border border-line bg-gradient-to-br from-primary/10 via-transparent to-success/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-t1">{credit.name}</h1>
              {credit.frozen && <span title="Цикл заморозки">🧊</span>}
              {credit.status === 'CLOSED' && <span>✅</span>}
            </div>
            <p className="mt-1 text-xs text-t3">
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
              className="rounded-lg border border-line px-3 py-2 text-sm text-t2 transition hover:border-primary/50"
            >
              {editing ? 'Закрыть' : 'Изменить'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-t3">Остаток долга</p>
            <p className="tabular text-lg font-semibold text-t1">{formatMoney(credit.outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-t3">Первоначально</p>
            <p className="tabular text-lg font-semibold text-t1">{formatMoney(credit.principal)}</p>
          </div>
          <div>
            <p className="text-xs text-t3">Выплачено</p>
            <p className="tabular text-lg font-semibold text-success">{formatMoney(credit.totalPaid)}</p>
          </div>
          {credit.type !== 'LOAN' ? (
            <div>
              <p className="text-xs text-t3">Срок / день платежа</p>
              <p className="font-semibold text-t1">
                {credit.termMonths} мес.
                {credit.paymentDay ? ` · ${credit.paymentDay}-е` : ''}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-t3">Ставка</p>
              <p className="font-semibold text-t1">{Number(credit.annualRate)}%</p>
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
            className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger transition hover:bg-danger/10"
          >
            Удалить кредит
          </button>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-t2">
            Долг погашен на <span className="font-medium text-t1">{percent}%</span>
            {' — '}
            <span className="tabular text-t2">{formatMoney(principalPaid)}</span> из{' '}
            <span className="tabular text-t2">{formatMoney(credit.principal)}</span>
          </p>
          <p className="text-xs text-t3">
            Всего выплачено <span className="tabular text-t2">{formatMoney(credit.totalPaid)}</span>
            {' '}(тело {formatMoney(principalPaid)} + проценты {formatMoney(interestPaid)})
          </p>
          <p className="text-xs text-t3">
            Остаток долга <span className="tabular text-t2">{formatMoney(credit.outstanding)}</span>
            {' '}(<span className="tabular">{100 - percent}%</span> от первоначальной суммы)
          </p>
        </div>

        {credit.frozen && credit.nextFreezeCheckAt && (
          <p className="mt-3 rounded-control bg-primary/10 px-3 py-2 text-xs text-primary">
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

      {credit.status === 'ACTIVE' && credit.type !== 'LOAN' && credit.type !== 'CREDIT_CARD' && (
        <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-medium text-t1">Досрочное погашение</h2>
          <p className="mt-0.5 text-xs text-t3">
            График пересчитается автоматически: {credit.prepaymentMode === 'REDUCE_TERM' ? 'сократится срок' : 'уменьшится платёж'}
          </p>

          <form
            onSubmit={handleSubmit((values) => {
              if (submitting.current) return;
              submitting.current = true;
              earlyMutation.mutate(values as any, {
                onSettled: () => {
                  submitting.current = false;
                },
              });
            })}
            className="mt-3 space-y-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block sm:w-40">
                <span className="text-sm text-t2">Сумма, ₽</span>
                <input type="number" step="0.01" inputMode="decimal" {...register('amount')} className={inputClass} />
                {formState.errors.amount && (
                  <p className="mt-1 text-xs text-danger">{formState.errors.amount.message}</p>
                )}
              </label>

              <label className="block sm:w-44">
                <span className="text-sm text-t2">Дата внесения</span>
                <input
                  type="date"
                  {...register('date')}
                  min={credit.startDate ? new Date(credit.startDate).toISOString().slice(0, 10) : undefined}
                  max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                  className={inputClass + " w-full max-w-full box-border"}
                />
                {formState.errors.date && (
                  <p className="mt-1 text-xs text-danger">{formState.errors.date.message}</p>
                )}
              </label>

              <div className="block sm:w-48">
                <span className="text-sm text-t2">Режим</span>
                <div className="mt-1">
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary">Сокращение срока</span>
                </div>
              </div>

            </div>
            <div>
              <button
                type="submit"
                className="rounded-control bg-success px-4 py-2.5 font-medium text-white transition hover:bg-emerald-400"
              >
                Внести
              </button>
            </div>
          </form>

          {preview && (
            <div className="mt-3 rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm">
              <p className="text-xs text-success/70">
                Проценты за период: {formatMoney(preview.accruedInterest)} · в тело: {formatMoney(preview.principalPart)}
              </p>
              {preview.isFull ? (
                <p className="font-medium text-success">
                  🎉 Полное закрытие кредита: сэкономите{' '}
                  <span className="tabular">{formatMoney(preview.interestSaved)}</span> процентов
                  {' '}и <span className="font-semibold">{preview.monthSaved} мес.</span>
                </p>
              ) : (
                <>
                  <p className="font-medium text-success">
                    Экономия: <span className="tabular">{formatMoney(preview.interestSaved)}</span>{' '}
                    процентов
                    {preview.monthSaved > 0 && (
                      <> и <span className="font-semibold">{preview.monthSaved} мес.</span> срока</>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-success/70">
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

      {error && <p className="text-sm text-danger">{error}</p>}

      {credit.type !== 'LOAN' && (
      <section className="rounded-card border border-line bg-surface p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="min-w-0 text-sm font-medium text-t1">
            График платежей{' '}
            {pending.length > 0 && <span className="text-t3">· к оплате {pending.length}</span>}
          </h2>
          {paid.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPaid((v) => !v)}
              className="w-full shrink-0 rounded-lg sm:w-auto border border-line px-2.5 py-1.5 text-xs text-t2 transition hover:border-primary/50"
            >
              {showAllPaid ? 'Свернуть оплаченные' : `Показать оплаченные (${paid.length})`}
            </button>
          )}
        </div>

        {collapsedCount > 0 && (
          <p className="mt-3 rounded-control bg-surface2 px-3 py-2 text-xs text-t2">
            {collapsedCount} прошедших платежей уже учтены как оплаченные. Нажмите «Показать оплаченные», чтобы посмотреть.
          </p>
        )}

        <div className="mt-3 divide-y divide-line">
          {visible.map((item) => {
            const expanded = payingId === item.id;
            const today = new Date().toISOString().slice(0, 10);
            return (
              <div key={item.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-t1">{formatDate(item.dueDate)}</p>
                    <p className="text-xs text-t3">
                      тело {formatMoney(item.principalPart)} · проценты {formatMoney(item.interestPart)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-sm font-medium text-t1">
                      {formatMoney(item.amount)}
                    </span>
                    {item.status === 'PAID' ? (
                      <div className="flex items-center gap-2">
                        {earlyKeys.has(`${new Date(item.paidAt ?? item.dueDate).toISOString().slice(0, 10)}|${Number(item.paidAmount ?? item.amount)}`) ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Досрочно</span>
                        ) : (
                          <StatusBadge status="PAID" />
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Отменить платёж ${formatMoney(item.amount)} от ${formatDate(item.dueDate)}? Статус изменится на «Не оплачен», график пересчитается.`)) return;
                            setCancelingId(item.id);
                            try {
                              await (paymentsApi as any).cancelSchedule(item.id);
                              await queryClient.invalidateQueries({ queryKey: ['credit', id] });
                              await queryClient.invalidateQueries({ queryKey: ['credits'] });
                              await queryClient.invalidateQueries({ queryKey: ['summary'] });
                              toast.show('Платёж отменён');
                            } catch (err) {
                              setError(extractErrorMessage(err));
                            } finally {
                              setCancelingId(null);
                            }
                          }}
                          disabled={cancelingId === item.id}
                          className="rounded-lg border border-danger/40 px-2 py-1 text-[11px] font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                        >
                          {cancelingId === item.id ? '…' : 'Отменить'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPayingId(expanded ? null : item.id)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90"
                      >
                        {expanded ? 'Отмена' : 'Я оплатил'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <form
                    className="mt-3 rounded-control border border-line bg-bg/60 p-3"
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
                    <p className="text-xs text-t2">
                      Фактическая оплата. Оставьте как есть, если заплатили вовремя и всю сумму —
                      тогда тело долга уменьшится на {formatMoney(item.principalPart)}.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] text-t3">Сумма, ₽</span>
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={Number(item.amount)}
                          className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-t1 outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-t3">Дата платежа</span>
                        <input
                          name="paidAt"
                          type="date"
                          defaultValue={today}
                          className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-t1 outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={payMutation.isPending}
                      className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      {payMutation.isPending ? '…' : 'Подтвердить оплату'}
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
        <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-medium text-t1">История платежей</h2>
          <div className="mt-3 space-y-2">
            {credit.events.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <span className="text-t2">
                  {formatDate(event.paidAt)} · {EVENT_LABELS[event.kind]}
                </span>
                <span className="tabular text-t1">{formatMoney(event.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
