import { round2 } from './round';

/** Пороговые отметки для мотивационных уведомлений («Вы закрыли N% долга!»). */
export const MILESTONES = [25, 50, 75, 100] as const;

export type Milestone = (typeof MILESTONES)[number];

/** Доля погашенного ТЕЛА долга в процентах.
 *  Считаем от долга, а не от всех выплат: проценты банку долг не уменьшают. */
export function paidPercent(principal: number, outstanding: number): number {
  if (principal <= 0) return 100;
  const paid = Math.max(0, principal - outstanding);
  return round2((paid / principal) * 100);
}

/** Какую отметку пересёк пользователь при последнем платеже (или null). */
export function crossedMilestone(prevPercent: number, nextPercent: number): Milestone | null {
  for (const milestone of MILESTONES) {
    if (prevPercent < milestone && nextPercent >= milestone) return milestone;
  }
  return null;
}

/** Текст мотивационного уведомления. */
export function milestoneMessage(creditName: string, milestone: Milestone): string {
  if (milestone >= 100) return `🎉 Поздравляем! «${creditName}» полностью закрыт!`;
  return `🎉 Вы закрыли ${milestone}% долга по «${creditName}»! Так держать.`;
}
