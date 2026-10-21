import { useState } from 'react';
import { creditsApi } from '../api/credits';
import { extractErrorMessage } from '../api/client';
import { CREDIT_TYPE_LABELS, formatDate } from '../utils/format';

/** Скачивание файла в браузере без сервера. */
function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Экспорт данных: JSON (полный бэкап) и CSV (график платежей для таблиц).
 * У конкурентов это платная функция — здесь бесплатно, данные и так на сервере.
 */
export function DataExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      return await creditsApi.exportData();
    } catch (err) {
      setError(extractErrorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    const data = await load();
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    download(`credit-tracker-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const exportCsv = async () => {
    const data = await load();
    if (!data) return;

    const rows: string[] = ['Кредит;Тип;Дата платежа;Сумма;Тело;Проценты;Статус'];
    for (const credit of data.credits) {
      for (const item of credit.schedule) {
        rows.push(
          [
            credit.name,
            CREDIT_TYPE_LABELS[credit.type as keyof typeof CREDIT_TYPE_LABELS] ?? credit.type,
            formatDate(item.dueDate),
            Number(item.amount).toFixed(2).replace('.', ','),
            Number(item.principalPart).toFixed(2).replace('.', ','),
            Number(item.interestPart).toFixed(2).replace('.', ','),
            item.status,
          ].join(';'),
        );
      }
    }
    // BOM, чтобы Excel корректно открыл кириллицу и разделитель ";"
    const stamp = new Date().toISOString().slice(0, 10);
    download(`credit-tracker-${stamp}.csv`, '\uFEFF' + rows.join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="font-medium text-slate-100">Экспорт данных</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Сохраните копию на устройство. JSON — полный бэкап, CSV — график для Excel.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportCsv}
          disabled={busy}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-500/50 disabled:opacity-50"
        >
          📄 Скачать CSV
        </button>
        <button
          type="button"
          onClick={exportJson}
          disabled={busy}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-500/50 disabled:opacity-50"
        >
          💾 Скачать JSON (бэкап)
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </section>
  );
}
