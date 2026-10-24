import {
  Banknote,
  CheckCircle2,
  CreditCard,
  HandCoins,
  House,
  MoreVertical,
  Pencil,
  Receipt,
  Snowflake,
  Trash2,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreditListItem, CreditType } from '../types';
import {
  CREDIT_TYPE_LABELS,
  daysUntil,
  debtPaidPercent,
  describeDueDate,
  formatDateShort,
  formatMoney,
  formatMoneyShort,
  urgencyTone,
} from '../utils/format';
import { BottomSheet } from './BottomSheet';
import { useToast } from './Toast';
import { creditsApi } from '../api/credits';
import { paymentsApi } from '../api/payments';
import { extractErrorMessage } from '../api/client';

const TYPE_ICON: Record<CreditType, typeof CreditCard> = {
  CREDIT_CARD: CreditCard,
  LOAN: HandCoins,
  MORTGAGE: House,
  INSTALLMENT: Receipt,
  MICROLOAN: Zap,
  CONSUMER: Banknote,
};

/** Акцент срочности для плашки ближайшего платежа. */
const TONE = {
  danger: { border: 'border-l-danger', text: 'text-danger', dot: 'bg-danger' },
  warning: { border: 'border-l-warning', text: 'text-warning', dot: 'bg-warning' },
  muted: { border: 'border-l-line', text: 'text-t2', dot: 'bg-t3' },
} as const;

interface Props {
  credit: CreditListItem;
  /** Задержка stagger-анимации появления, мс. */
  index?: number;
}

export function CreditRow({ credit, index = 0 }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyAmount, setEarlyAmount] = useState('');
  const [earlyMode, setEarlyMode] = useState('REDUCE_PAYMENT');
  const [earlyDate, setEarlyDate] = useState(new Date().toISOString().slice(0,10));
  const [earlyPending, setEarlyPending] = useState(false);
  const [earlyError, setEarlyError] = useState<string | null>(null);
  const percent = debtPaidPercent(credit.principal, credit.outstanding);
  const isClosed = credit.status === 'CLOSED';
  const next = credit.nextPayment;
  const Icon = TYPE_ICON[credit.type] ?? Banknote;

  // Анимация заполнения прогресс-бара при появлении (0 → значение, 600ms).
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setBarWidth(percent), 40);
    return () => window.clearTimeout(t);
  }, [percent]);

  const freezeMutation = useMutation({
    mutationFn: ({ id, newFrozenState }: { id: string; newFrozenState: boolean }) =>
      creditsApi.toggleFreeze(id, newFrozenState),
    onMutate: async ({ id, newFrozenState }) => {
      await queryClient.cancelQueries({ queryKey: ['credits'] });
      const previousCredits = queryClient.getQueryData(['credits']);
      queryClient.setQueryData(['credits'], (old: any) =>
        Array.isArray(old)
          ? old.map((c: any) => (c.id === id ? { ...c, frozen: newFrozenState } : c))
          : old,
      );
      return { previousCredits };
    },
    onError: (err, variables, context: any) => {
      queryClient.setQueryData(['credits'], context?.previousCredits);
      setError(extractErrorMessage(err));
      toast.show('Ошибка заморозки');
    },
    onSuccess: (_data, variables) => {
      toast.show(variables.newFrozenState ? 'Грейс активен' : 'Грейс слетел');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['summary'], refetchType: 'none' });
    },
  });

  const handleFreezeClick = () => {
    navigator.vibrate?.(25);
    setOpen(false);
    freezeMutation.mutate({ id: credit.id, newFrozenState: !credit.frozen });
  };

  const remove = async () => {
    if (!window.confirm('Удалить кредит и весь график платежей?')) return;
    try {
      navigator.vibrate?.(25);
      await creditsApi.remove(credit.id);
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast.show('Кредит удалён');
      setOpen(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const renewCycle = async () => {
    try {
      await creditsApi.renewFreezeCycle(credit.id);
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast.show('Период обновлён — цикл сдвинут');
      setOpen(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  // Карта в цикле заморозки: минимального платежа нет, есть только сумма
  // обновления беспроцентного периода (её пропускать нельзя).
  const freezeCycle = credit.frozen && credit.type === 'CREDIT_CARD';
  const cycleDay = credit.graceReplenishDay ?? credit.paymentDay;
  const cycleSum = credit.graceReplenishSum ? Number(credit.graceReplenishSum) : null;
  const tone = next ? TONE[urgencyTone(daysUntil(next.dueDate))] : TONE.muted;

  return (
    <>
      <div
        className="animate-fade-up card tap relative"
        style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
      >
        <Link to={`/credits/${credit.id}`} className="block p-4 pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary/12 text-primary">
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-body font-semibold text-t1">{credit.name}</h3>
                  {credit.frozen && (
                    <Snowflake size={15} className="shrink-0 text-primary" aria-label="В заморозке" />
                  )}
                  {isClosed && (
                    <CheckCircle2
                      size={15}
                      className="shrink-0 text-success"
                      aria-label="Закрыт"
                    />
                  )}
                </div>
                <p className="mt-0.5 truncate text-caption text-t3">
                  {CREDIT_TYPE_LABELS[credit.type]} · {Number(credit.annualRate)}% годовых
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="tabular text-heading font-bold text-t1">
                {formatMoneyShort(credit.outstanding)}
              </p>
              <p className="text-micro text-t3">остаток</p>
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className={`h-full rounded-full transition-[width] duration-[600ms] ease-app ${
                isClosed
                  ? 'bg-success'
                  : 'bg-gradient-to-r from-primary to-success'
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>

          {next && !isClosed && !freezeCycle && (
            <div
              className={`card-inner mt-3 flex items-center justify-between border-l-[3px] py-2 pl-2.5 pr-3 text-base ${tone.border}`}
            >
              <span className="flex items-center gap-2 text-t2">
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                Ближайший платёж
              </span>
              <span className="text-right">
                <span className="tabular font-semibold text-t1">{formatMoneyShort(next.amount)}</span>
                <span className={`ml-2 text-caption ${tone.text}`}>
                  {formatDateShort(next.dueDate)} · {describeDueDate(next.dueDate)}
                </span>
              </span>
            </div>
          )}

          {freezeCycle && !isClosed && (
            <div className="card-inner mt-3 flex items-center justify-between py-2 pl-2.5 pr-3 text-base">
              <span className="flex items-center gap-2 text-t2">
                <Snowflake size={15} className="text-primary" />
                Обновить период{cycleDay ? ` до ${cycleDay}-го` : ''}
              </span>
              <span className="text-right">
                {cycleSum !== null ? (
                  <span className="tabular font-semibold text-t2">{formatMoneyShort(cycleSum)}</span>
                ) : (
                  <span className="text-caption text-t3">сумма не задана</span>
                )}
                {credit.nextFreezeCheckAt && (
                  <span className="ml-2 text-caption text-t3">
                    до {formatDateShort(credit.nextFreezeCheckAt)}
                  </span>
                )}
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full text-t3 transition-colors active:bg-surface2"
          aria-label="Меню действий"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={credit.name}>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(`/credits/${credit.id}`);
            }}
            className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-t1 transition-colors active:bg-surface2"
          >
            <Pencil size={18} className="text-t2" />
            <span>Редактировать</span>
          </button>
          <button
            type="button"
            onClick={handleFreezeClick}
            className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-t1 transition-colors active:bg-surface2"
          >
            <Snowflake size={18} className="text-primary" />
            <span>{credit.frozen ? 'Грейс слетел' : 'Грейс активен'}</span>
          </button>
          {freezeCycle && (
            <button
              type="button"
              onClick={renewCycle}
              className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-primary transition-colors active:bg-primary/10"
            >
              <CheckCircle2 size={18} />
              <span>Я обновил период (внёс сумму)</span>
            </button>
          )}
          {credit.type !== 'LOAN' && !isClosed && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEarlyOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-t1 transition-colors active:bg-surface2"
            >
              <TrendingDown size={18} className="text-success" />
              <span>Досрочное погашение</span>
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-danger transition-colors active:bg-danger/10"
          >
            <Trash2 size={18} />
            <span>Удалить</span>
          </button>
          {error && <p className="px-3 pt-1 text-caption text-danger">{error}</p>}
        </div>
      </BottomSheet>

      <BottomSheet open={earlyOpen} onClose={() => setEarlyOpen(false)} title="Досрочное погашение">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const amount = Number(earlyAmount);
            if (!amount || amount <= 0) { setEarlyError('Сумма должна быть больше 0'); return; }
            setEarlyPending(true);
            setEarlyError(null);
            try {
              await paymentsApi.earlyRepayment(credit.id, { amount, mode: earlyMode as any, date: earlyDate });
              await queryClient.invalidateQueries({ queryKey: ['credits'] });
              await queryClient.invalidateQueries({ queryKey: ['credit', credit.id] });
              await queryClient.invalidateQueries({ queryKey: ['summary'] });
              toast.show('Досрочный платёж внесён');
              setEarlyOpen(false);
              setEarlyAmount('');
            } catch (err) {
              setEarlyError(extractErrorMessage(err));
            } finally {
              setEarlyPending(false);
            }
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-sm text-t2">Сумма, ₽</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={earlyAmount}
              onChange={(e) => setEarlyAmount(e.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm text-t2">Дата внесения</span>
            <input
              type="date"
              value={earlyDate}
              onChange={(e) => setEarlyDate(e.target.value)}
              className="mt-1 w-full max-w-full box-border rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm text-t2">Режим</span>
            <select
              value={earlyMode}
              onChange={(e) => setEarlyMode(e.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none focus:border-primary"
            >
              <option value="REDUCE_PAYMENT">Уменьшить платёж</option>
              <option value="REDUCE_TERM">Сократить срок</option>
            </select>
          </label>
          {earlyError && <p className="text-sm text-danger">{earlyError}</p>}
          <button
            type="submit"
            disabled={earlyPending}
            className="w-full rounded-control bg-success px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {earlyPending ? 'Пересчитываю…' : 'Внести'}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}

