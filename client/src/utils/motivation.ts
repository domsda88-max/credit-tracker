/**
 * Слоты ежедневной мотивации от выбранного времени.
 *
 * День делится на `perDay` равных интервалов, первый слот — ровно
 * выбранное пользователем время. Минуты сохраняются, а не обнуляются
 * до :00 (иначе 09:30 превращалось в 09:00).
 */
export function motivationSlots(start: string, perDay: number): string[] {
  const [rawHours, rawMinutes] = start.split(':').map(Number);
  const total = Math.max(0, Math.min(24, Math.floor(perDay)));
  if (total === 0) return [];

  const safeHours = Number.isFinite(rawHours) ? rawHours : 9;
  const safeMinutes = Number.isFinite(rawMinutes) ? rawMinutes : 30;
  const startMinutes = safeHours * 60 + safeMinutes;
  const step = Math.round(1440 / total);

  return Array.from({ length: total }, (_, index) => {
    const minutes = ((startMinutes + index * step) % 1440 + 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
      minutes % 60,
    ).padStart(2, '0')}`;
  });
}
