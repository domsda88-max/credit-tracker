import { useMemo, useState } from 'react';
import { formatDate } from '../utils/format';
import { parseClassicCsv, type ParsedClassicCsv } from '../utils/csv';

export function CsvImportPage() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedClassicCsv | null>(null);
  const [busy, setBusy] = useState(false);

  const includedCount = useMemo(
    () => (parsed ? parsed.rows.filter((r) => r.included).length : 0),
    [parsed],
  );

  const handleFile = async (file: File) => {
    setBusy(true);
    setFileName(file.name);
    try {
      const content = await file.text();
      setText(content);
      setParsed(parseClassicCsv(content));
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = (index: number) => {
    if (!parsed) return;
    const rows = [...parsed.rows];
    rows[index] = { ...rows[index], included: !rows[index].included };
    const total = rows.reduce((acc, r) => {
      if (!r.included || r.amount === null) return acc;
      return Math.round((acc + r.amount + Number.EPSILON) * 100) / 100;
    }, 0);
    setParsed({ headers: parsed.headers, rows, totalIncluded: total });
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-heading font-semibold text-t1">Импорт транзакций (CSV)</h1>
        <p className="mt-1 text-sm text-t3">
          Классический формат: дата, сумма, заметка. Поддерживаем разделители `,` и `;`, даты
          `DD.MM.YYYY` и ISO. Перед импортом обязательно проверьте предпросмотр.
        </p>
      </header>

      <section className="card p-4">
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="text-sm text-t2"
          />
          {fileName && (
            <p className="text-xs text-t3">
              Файл: <span className="font-medium text-t1">{fileName}</span>
              {busy ? '…читаем' : ''}
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'дата,сумма,заметка\n2026-11-01,10000,Досрочное\n2026-12-01,30000,Плановый'}
            className="rounded-control border border-surface2 bg-surface px-3 py-2 text-sm text-t1"
            rows={6}
          />
          <button
            className="self-start rounded-control bg-primary px-4 py-2 text-sm font-medium text-bg transition hover:bg-primary/90"
            onClick={() => setParsed(parseClassicCsv(text))}
            type="button"
          >
            Распознать
          </button>
        </div>
      </section>

      {parsed && (
        <section className="card mt-4 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-heading font-semibold text-t1">Предпросмотр</h2>
            <p className="text-caption text-t3">
              {includedCount} из {parsed.rows.length} строк, сумма{' '}
              <span className="font-medium text-t1">{parsed.totalIncluded}</span>
            </p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-t3">
                <tr>
                  <th className="py-1 pr-2">Учитывать</th>
                  <th className="py-1 pr-2">Дата</th>
                  <th className="py-1 pr-2">Сумма</th>
                  <th className="py-1 pr-2">Заметка</th>
                </tr>
              </thead>
              <tbody className="text-t1">
                {parsed.rows.map((r, idx) => (
                  <tr key={idx} className={r.included ? '' : 'opacity-40'}>
                    <td className="py-1 pr-2">
                      <input type="checkbox" checked={r.included} onChange={() => toggleRow(idx)} />
                    </td>
                    <td className="py-1 pr-2 tabular">
                      {r.date ? formatDate(r.date) : <span className="text-danger-fg">{r.raw[0]}</span>}
                    </td>
                    <td className="py-1 pr-2 tabular">
                      {r.amount !== null ? r.amount.toFixed(2) : <span className="text-danger-fg">{r.raw[1]}</span>}
                    </td>
                    <td className="py-1 pr-2 text-t3">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsed.rows.some((r) => r.error) && (
            <div className="mt-3 rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger-fg">
              {parsed.rows
                .map((r, idx) => (r.error ? `${idx + 1}: ${r.error}` : null))
                .filter(Boolean)
                .join('; ')}
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-bg opacity-60"
              disabled
              title="Следующий шаг: привязка к кредитам и импорт платежей"
            >
              Импортировать (скоро)
            </button>
            <p className="mt-2 text-xs text-t3">
              Дальше в PR: выбор кредита для каждой строки и применение через API платежей.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}