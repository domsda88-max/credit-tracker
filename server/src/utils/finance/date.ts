/**
 * Утилиты дат. Все даты платежей работают в UTC (@db.Date) —
 * полночь UTC, чтобы избежать сдвигов часовых поясов при хранении.
 */

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Прибавить месяцы, сохранив день месяца (с клампом на короткие месяцы: 31 → 30/28). */
export function addMonths(date: Date, months: number): Date {
  const year0 = date.getUTCFullYear();
  const month0 = date.getUTCMonth();
  const totalMonth = month0 + months;
  const year = year0 + Math.floor(totalMonth / 12);
  const month = ((totalMonth % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

/** Установить конкретный день месяца (paymentDay), с клампом на короткие месяцы. */
export function withDayOfMonth(date: Date, day?: number | null): Date {
  if (!day || day < 1) return new Date(date.getTime());
  const d = new Date(date.getTime());
  d.setUTCDate(Math.min(day, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())));
  return d;
}

/** Дата первого платежа: следующий месяц от выдачи, с учётом paymentDay. */
export function firstDueDate(startDate: Date, paymentDay?: number | null): Date {
  return withDayOfMonth(addMonths(startDate, 1), paymentDay);
}

/** Массив дат платежей от первого до последнего. */
export function buildDueDates(startDate: Date, count: number, paymentDay?: number | null): Date[] {
  const first = firstDueDate(startDate, paymentDay);
  const dates: Date[] = [];
  for (let k = 0; k < count; k++) dates.push(addMonths(first, k));
  return dates;
}

/** Сегодняшняя дата без времени (UTC-полночь). */
export function utcToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addUTCDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Совпадают ли даты (без времени). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Количество полных месяцев между датами. */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

/** Формат «ДД.ММ.ГГГГ» (для текстов уведомлений). */
export function formatDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

/** ISO-дата YYYY-MM-DD (для ключей идемпотентности). */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
