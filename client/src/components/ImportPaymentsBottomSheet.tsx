import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { extractErrorMessage } from '../api/client';
import { creditsApi } from '../api/credits';
import { paymentsApi } from '../api/payments';
import type { ImportPaymentsResult } from '../types';
import { parseCsv, type ParsedPaymentRow } from '../utils/csvParser';
import { BottomSheet } from './BottomSheet';
import { useToast } from './useToast';

/** Сервер принимает body до 1 МБ и не более 2000 строк за раз. */
const MAX_FILE_SIZE = 1_000_000;
const MAX_ROWS = 2000;

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Оплачен',
  PENDING: 'Ожидает',
  OVERDUE: 'Просрочен',
};

type Step = 'upload' | 'preview' | 'result';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function displayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

export function ImportPaymentsBottomSheet({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ParsedPaymentRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportPaymentsResult | null>(null);
  const [resultRows, setResultRows] = useState<ParsedPaymentRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: credits = [] } = useQuery({
    queryKey: ['credits'],
    queryFn: creditsApi.list,
    enabled: isOpen,
    staleTime: 30_000,
  });

  const reset = () => {
    setStep('upload');
    setRows([]);
    setParseErrors([]);
    setSelected(new Set());
    setOverrides({});
    setBusy(false);
    setResult(null);
    setResultRows([]);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  const close = () => {
    reset();
    onClose();
  };

  const matchesFor = (row: ParsedPaymentRow) =>
    credits.filter((credit) => credit.name.trim() === row.creditName.trim());

  const toggle = (rawRowNumber: number) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(rawRowNumber)) next.delete(rawRowNumber);
      else next.add(rawRowNumber);
      return next;
    });
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.show('Файл больше 1 МБ — уменьшите выгрузку', 'error');
      return;
    }

    // Экспорт всегда UTF-8 с BOM; читаем строго как UTF-8.
    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.rows.length === 0) {
      setParseErrors(parsed.errors);
      toast.show(parsed.errors[0] ?? 'В файле нет строк для импорта', 'error');
      return;
    }

    const paidCount = parsed.rows.filter((row) => row.status === 'PAID').length;
    if (paidCount > MAX_ROWS) {
      toast.show(`Оплаченных строк больше ${MAX_ROWS} — импортируйте файл частями`, 'error');
      return;
    }

    setRows(parsed.rows);
    setParseErrors(parsed.errors);
    // По умолчанию отмечаем только фактически оплаченные строки.
    setSelected(new Set(parsed.rows.filter((row) => row.status === 'PAID').map((row) => row.rawRowNumber)));
    setStep('preview');
  };

  const selectedRows = rows.filter((row) => selected.has(row.rawRowNumber));
  const unresolvedCollisions = selectedRows.filter(
    (row) => matchesFor(row).length > 1 && !overrides[row.rawRowNumber],
  );
  const selectedWithoutCredit = selectedRows.filter((row) => matchesFor(row).length === 0);

  const handleSubmit = async () => {
    if (unresolvedCollisions.length > 0) {
      toast.show(
        `Выберите кредит для строк: ${unresolvedCollisions.map((row) => row.rawRowNumber).join(', ')}`,
        'error',
      );
      return;
    }

    const importable = selectedRows.filter((row) => matchesFor(row).length > 0);
    if (importable.length === 0) {
      toast.show('Нечего импортировать', 'error');
      return;
    }

    const payload = importable.map((row) => {
      const matches = matchesFor(row);
      return {
        creditId: overrides[row.rawRowNumber] ?? (matches.length === 1 ? matches[0].id : undefined),
        creditName: row.creditName,
        dueDate: row.dueDate,
        paidAt: row.paidAt,
        amount: row.amount,
      };
    });

    setBusy(true);
    try {
      const data = await paymentsApi.importPayments(payload);
      setResult(data);
      setResultRows(importable);
      setStep('result');
      if (selectedWithoutCredit.length > 0) {
        toast.show(`${selectedWithoutCredit.length} строк пропущено: кредит не найден`, 'info');
      }
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      await queryClient.invalidateQueries({ queryKey: ['credit'] });
      onSuccess?.();
    } catch (error) {
      toast.show(extractErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={isOpen} onClose={close} title="Импорт оплат">
      {step === 'upload' && (
        <div className="flex flex-col items-center gap-4 px-2 py-6 text-center">
          <FileUp size={40} className="text-primary-fg" aria-hidden="true" />
          <div>
            <p className="text-base font-medium text-t1">Выберите CSV-файл</p>
            <p className="mt-1 text-sm text-t3">
              Подойдёт файл, скачанный через «Экспорт CSV». Импортируются только строки
              со статусом «Оплачен».
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
          />
          <button type="button" className="btn btn-primary w-full" onClick={() => fileInputRef.current?.click()}>
            Выбрать файл
          </button>
          <p className="text-xs text-t3">UTF-8, до 1 МБ и до {MAX_ROWS} оплаченных строк.</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-t2">
              Отмечено {selected.size} из {rows.filter((row) => row.status === 'PAID').length} оплаченных
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-primary-fg"
                onClick={() =>
                  setSelected(
                    new Set(rows.filter((row) => row.status === 'PAID').map((row) => row.rawRowNumber)),
                  )
                }
              >
                Выбрать все
              </button>
              <button type="button" className="text-xs text-t3" onClick={() => setSelected(new Set())}>
                Снять
              </button>
            </div>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-control border border-warning/30 bg-warning/10 p-2 text-xs text-warning-fg">
              {parseErrors.slice(0, 5).map((error) => (
                <p key={error}>{error}</p>
              ))}
              {parseErrors.length > 5 && <p>…и ещё {parseErrors.length - 5}</p>}
            </div>
          )}

          <div className="max-h-[50vh] space-y-1 overflow-auto">
            {rows.map((row) => {
              const matches = matchesFor(row);
              const isPaid = row.status === 'PAID';
              const checked = selected.has(row.rawRowNumber);

              return (
                <div
                  key={row.rawRowNumber}
                  className={`flex items-start gap-2 rounded-control border border-line p-2 ${
                    isPaid ? 'bg-surface2/40' : 'opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={checked}
                    disabled={!isPaid}
                    onChange={() => toggle(row.rawRowNumber)}
                    aria-label={`Строка ${row.rawRowNumber}: ${row.creditName}, ${displayDate(row.dueDate)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-t1">{displayDate(row.dueDate)}</span>
                      <span
                        className={`rounded-chip px-1.5 py-0.5 text-[10px] ${
                          isPaid ? 'bg-success/15 text-success-fg' : 'bg-surface2 text-t3'
                        }`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </div>
                    <p className="truncate text-xs text-t3">
                      {row.creditName} · {row.amount ? `${row.amount.toLocaleString('ru-RU')} ₽` : 'сумма по графику'}
                    </p>

                    {matches.length > 1 && isPaid && checked && (
                      <select
                        className="field mt-1 text-xs"
                        value={overrides[row.rawRowNumber] ?? ''}
                        onChange={(event) =>
                          setOverrides((previous) => ({
                            ...previous,
                            [row.rawRowNumber]: event.target.value,
                          }))
                        }
                        aria-label={`Кредит для строки ${row.rawRowNumber}`}
                      >
                        <option value="">Выберите кредит</option>
                        {matches.map((credit) => (
                          <option key={credit.id} value={credit.id}>
                            {credit.name} · {credit.id.slice(0, 4)}
                          </option>
                        ))}
                      </select>
                    )}

                    {matches.length === 0 && (
                      <p className="mt-1 text-xs text-danger-fg">Кредит не найден — строка будет пропущена</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={handleSubmit}
            disabled={busy || selected.size === 0}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Импортируем…
              </>
            ) : (
              `Импортировать выбранные (${selected.size})`
            )}
          </button>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-control bg-success/10 p-3">
              <p className="text-title font-bold text-success-fg">{result.created}</p>
              <p className="text-xs text-t3">создано</p>
            </div>
            <div className="rounded-control bg-surface2 p-3">
              <p className="text-title font-bold text-t1">{result.skipped}</p>
              <p className="text-xs text-t3">пропущено</p>
            </div>
            <div className="rounded-control bg-danger/10 p-3">
              <p className="text-title font-bold text-danger-fg">{result.failed.length}</p>
              <p className="text-xs text-t3">ошибок</p>
            </div>
          </div>

          {result.failed.length > 0 && (
            <div className="max-h-[40vh] overflow-auto rounded-control border border-line bg-surface2/50 p-2">
              {result.failed.map((failure, index) => (
                <p key={`${failure.row}-${index}`} className="text-xs text-danger-fg">
                  Строка {resultRows[failure.row - 1]?.rawRowNumber ?? failure.row}: {failure.reason}
                </p>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-primary w-full" onClick={close}>
            Готово
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
