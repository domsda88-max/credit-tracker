import { diffInDaysUTC } from './date';
import { round2 } from './round';

export interface AccruedInput {
  outstanding: number;
  annualRate: number;
  anchorDate: Date;
  prepaymentDate: Date;
}

/** Простые проценты за период (anchor → дата внесения), база 365. */
export function accruedInterestForPeriod({
  outstanding,
  annualRate,
  anchorDate,
  prepaymentDate,
}: AccruedInput): { days: number; accruedInterest: number } {
  const days = Math.max(0, diffInDaysUTC(anchorDate, prepaymentDate));
  if (!Number.isFinite(outstanding) || !Number.isFinite(annualRate)) {
    return { days, accruedInterest: 0 };
  }
  const accruedInterest =
    annualRate > 0 ? round2((outstanding * annualRate * days) / 100 / 365) : 0;
  return { days, accruedInterest };
}
