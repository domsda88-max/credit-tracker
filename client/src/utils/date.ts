/** Верхняя граница даты досрочного погашения: +1 календарный год. */
export function maxPrepaymentDate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
