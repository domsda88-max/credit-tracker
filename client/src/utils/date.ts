/** Начало календарного дня в UTC. Даты графика хранятся в UTC, поэтому
 *  все сравнения «сегодня/текущий месяц» должны использовать одну и ту же
 *  шкалу — локальный setHours здесь даёт рассинхрон в UTC+3/+5/+7. */
export function startOfUTCDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Верхняя граница даты досрочного погашения: +1 календарный год. */
export function maxPrepaymentDate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
