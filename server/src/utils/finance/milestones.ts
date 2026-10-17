import { round2 } from './round';

/** Пороговые отметки для мотивационных уведомлений («Вы закрыли N% долга!»). */
export const MILESTONES = [25, 50, 75, 100] as const;

export type Milestone = (typeof MILESTONES)[number];

/** Доля погашенного в процентах от первоначальной суммы. */
export function paidPercent(totalPaid: number, principal: number): number {
  if (principal <= 0) return 100;
  return round2((totalPaid / principal) * 100);
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
