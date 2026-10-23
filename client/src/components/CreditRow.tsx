import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { CreditListItem } from '../types';
import {
  CREDIT_TYPE_LABELS,
  describeDueDate,
  debtPaidPercent,
  formatDate,
  formatMoneyShort,
} from '../utils/format';
import { BottomSheet } from './BottomSheet';
import { useToast } from './Toast';
import { creditsApi } from '../api/credits';
import { extractErrorMessage } from '../api/client';

function getIcon(type: CreditListItem['type']) {
  if (type === 'CREDIT_CARD') return '💳';
  if (type === 'LOAN') return '🤝';
  if (type === 'MORTGAGE') return '🏠';
  if (type === 'INSTALLMENT') return '🧾';
  if (type === 'MICROLOAN') return '⚡';
  return '💸';
}

interface Props {
  credit: CreditListItem;
}

export function CreditRow({ credit }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percent = debtPaidPercent(credit.principal, credit.outstanding);
  const isClosed = credit.status === 'CLOSED';
  const next = credit.nextPayment;

  const toggleFreeze = async () => {
    try {
      await creditsApi.toggleFreeze(credit.id, !credit.frozen);
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast.show(credit.frozen ? 'Кредит разморожен' : 'Кредит заморожен');
      setOpen(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!window.confirm('Удалить кредит и весь график платежей?')) return;
    try {
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

  return (
    <>
      <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <Link
          to={`/credits/${credit.id}`}
          className="block p-4 pr-12 transition active:scale-[0.99] hover:border-sky-500/40"
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

          {next && !isClosed && !freezeCycle && (
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

          {freezeCycle && !isClosed && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-sky-500/[0.07] px-3 py-2 text-sm">
              <span className="text-slate-400">
                🧊 Обновить период{cycleDay ? ` до ${cycleDay}-го` : ''}
              </span>
              <span className="text-right">
                {cycleSum !== null ? (
                  <span className="tabular font-medium text-sky-200">{formatMoneyShort(cycleSum)}</span>
                ) : (
                  <span className="text-xs text-slate-500">сумма не задана</span>
                )}
                {credit.nextFreezeCheckAt && (
                  <span className="ml-2 text-xs text-slate-500">
                    до {formatDate(credit.nextFreezeCheckAt)}
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
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-400 transition active:bg-slate-800/60"
          aria-label="Меню действий"
        >
          ⋮
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
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-200 transition active:bg-slate-800/60"
          >
            <span>✏️</span>
            <span>Редактировать</span>
          </button>
          <button
            type="button"
            onClick={toggleFreeze}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-200 transition active:bg-slate-800/60"
          >
            <span>❄️</span>
            <span>{credit.frozen ? 'Разморозить' : 'Заморозить'}</span>
          </button>
          {freezeCycle && (
            <button
              type="button"
              onClick={renewCycle}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sky-200 transition active:bg-sky-500/10"
            >
              <span>✅</span>
              <span>Я обновил период (внёс сумму)</span>
            </button>
          )}
          {credit.type !== 'LOAN' && !isClosed && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(`/credits/${credit.id}`);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-200 transition active:bg-slate-800/60"
            >
              <span>💸</span>
              <span>Досрочное погашение</span>
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-300 transition active:bg-rose-500/10"
          >
            <span>🗑️</span>
            <span>Удалить</span>
          </button>
          {error && <p className="px-3 pt-1 text-xs text-rose-400">{error}</p>}
        </div>
      </BottomSheet>
    </>
  );
}
