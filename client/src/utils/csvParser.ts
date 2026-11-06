/**
 * Парсер CSV из экспорта Credit Tracker.
 * Формат: UTF-8 с BOM, разделитель «;», десятичная запятая, поля в кавычках
 * при наличии «;», кавычек или переводов строк.
 *
 * Никаких сторонних библиотек — формат наш и полностью контролируется экспортом.
 */

export interface ParsedPaymentRow {
  creditName: string;
  /** Сырой статус из экспорта: PAID | PENDING | OVERDUE. */
  status: string;
  /** YYYY-MM-DD */
  dueDate: string;
  /** YYYY-MM-DD */
  paidAt: string;
  amount?: number;
  /** Номер строки в исходном файле (1-based, заголовок = 1). */
  rawRowNumber: number;
}

export interface CsvParseResult {
  rows: ParsedPaymentRow[];
  errors: string[];
}

const REQUIRED_HEADERS = ['Кредит', 'Дата платежа', 'Статус'] as const;

/** Разбор CSV с поддержкой кавычек, «""» и переводов строк внутри поля. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  record.push(field);
  if (!(record.length === 1 && record[0].trim() === '')) records.push(record);
  return records;
}

/** «31.12.2025» или «2025-12-31» → «2025-12-31»; null для несуществующих дат. */
function parseDateOnly(value: string): string | null {
  const trimmed = value.trim();
  let year: number;
  let month: number;
  let day: number;

  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (ru) {
    day = Number(ru[1]);
    month = Number(ru[2]);
    year = Number(ru[3]);
  } else {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!iso) return null;
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** «15990,50» → 15990.5; null, если это не положительное число. */
function parseAmount(value: string): number | null {
  const normalized = value.replace(/[\s\u00A0]/g, '').replace(',', '.');
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function parseCsv(text: string): CsvParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const table = parseDelimited(clean, ';');

  if (table.length < 2) {
    return { rows: [], errors: ['Файл пуст или содержит только заголовок'] };
  }

  const header = table[0].map((cell) => cell.trim());
  const column = new Map(header.map((name, index) => [name, index]));
  const missing = REQUIRED_HEADERS.filter((name) => !column.has(name));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `Это не похоже на экспорт Credit Tracker: нет колонок «${missing.join('», «')}»`,
      ],
    };
  }

  const rows: ParsedPaymentRow[] = [];
  const errors: string[] = [];

  for (let r = 1; r < table.length; r += 1) {
    const line = r + 1;
    const cells = table[r];
    const get = (name: string): string => {
      const index = column.get(name);
      return index === undefined ? '' : (cells[index] ?? '').trim();
    };

    const creditName = get('Кредит');
    if (!creditName) {
      errors.push(`Строка ${line}: не указан кредит`);
      continue;
    }

    const status = get('Статус').toUpperCase();
    if (!status) {
      errors.push(`Строка ${line}: не указан статус`);
      continue;
    }

    const dueDateRaw = get('Дата платежа');
    const dueDate = parseDateOnly(dueDateRaw);
    if (!dueDate) {
      errors.push(`Строка ${line}: неверная дата платежа «${dueDateRaw}»`);
      continue;
    }

    const paidAtRaw = get('Дата оплаты');
    const paidAt = paidAtRaw ? parseDateOnly(paidAtRaw) : dueDate;
    if (!paidAt) {
      errors.push(`Строка ${line}: неверная дата оплаты «${paidAtRaw}»`);
      continue;
    }

    // «Факт. сумма» появилась позже «Суммы»: старые файлы её не содержат.
    const amountRaw = get('Факт. сумма') || get('Сумма');
    const parsedAmount = amountRaw ? parseAmount(amountRaw) : null;
    if (amountRaw && parsedAmount === null) {
      errors.push(`Строка ${line}: неверная сумма «${amountRaw}»`);
      continue;
    }

    rows.push({
      creditName,
      status,
      dueDate,
      paidAt,
      amount: parsedAmount ?? undefined,
      rawRowNumber: line,
    });
  }

  return { rows, errors };
}
