export interface ParsedCsvRow {
  raw: string[];
  date: string | null;
  amount: number | null;
  note: string;
  included: boolean;
  error?: string;
}

export interface ParsedClassicCsv {
  headers: string[] | null;
  rows: ParsedCsvRow[];
  totalIncluded: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // DD.MM.YYYY or DD/MM/YYYY
  const dot = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dot) {
    const [, d, m, y] = dot;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return v;
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseAmount(value: string): number | null {
  const v = value.replace(/\s/g, '').replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : null;
}

function isHeader(row: string[]): boolean {
  // Header if the amount column is not a finite number.
  return parseAmount(row[1] ?? '') === null;
}

export function parseClassicCsv(text: string): ParsedClassicCsv {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const rawRows = lines.map((line) => splitCsvLine(line));
  const hasHeader = rawRows.length > 0 && isHeader(rawRows[0]);
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const headers = hasHeader ? rawRows[0] : null;

  const rows: ParsedCsvRow[] = dataRows.map((r) => {
    const date = parseDate(r[0] ?? '');
    const amount = parseAmount(r[1] ?? '');
    const note = r[2] ?? '';
    let error: string | undefined;
    if (!date) error = 'Некорректная дата';
    else if (amount === null || amount <= 0) error = 'Некорректная сумма';
    return { raw: r, date, amount, note, included: !error, error };
  });

  const totalIncluded = rows.reduce((acc, r) => {
    if (!r.included || r.amount === null) return acc;
    return Math.round((acc + r.amount + Number.EPSILON) * 100) / 100;
  }, 0);

  return { headers, rows, totalIncluded };
}