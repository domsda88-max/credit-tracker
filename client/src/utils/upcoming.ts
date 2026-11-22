import type { CreditListItem, InstallmentStatus } from '../types';
import { startOfUTCDay } from './date';

export interface UpcomingPaymentItem {
  creditId: string;
  creditName: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
  status: InstallmentStatus;
}

/**
 * Единственное место, где определяется список ближайших платежей.
 * Логика перенесена из UpcomingPayments без изменений: просроченныеFirst,
 * затем платежи текущего месяца, сортировка по дате. Никаких новых расчётов.
 */
export function getUpcomingPayments(credits: CreditListItem[]): UpcomingPaymentItem[] {
  // График строится в UTC (Date.UTC в date.ts), поэтому «сегодня» и месяц
  // считаем тоже в UTC. Раньше локальный setHours(0,0,0,0) в UTC+3/+5/+7
  // давал предыдущий UTC-день, из-за чего платежи 1-го числа пропадали.
  const today = startOfUTCDay();
  const curYear = today.getUTCFullYear();
  const curMonth = today.getUTCMonth();

  return credits
    .filter((c) => c.status === 'ACTIVE' && c.nextPayment)
    .map((c) => ({
      creditId: c.id,
      creditName: c.name,
      dueDate: c.nextPayment!.dueDate,
      // PARTIALLY_PAID: в ближайшем платеже показываем только невнесённый остаток.
      amount: Math.max(
        0,
        Number(c.nextPayment!.amount) - Number(c.nextPayment!.paidAmount ?? 0),
      ),
      overdue: new Date(c.nextPayment!.dueDate).getTime() < today.getTime(),
      status: c.nextPayment!.status,
    }))
    .filter((item) => {
      const d = new Date(item.dueDate);
      const isOverdue = d.getTime() < today.getTime();
      const isThisMonth = d.getUTCFullYear() === curYear && d.getUTCMonth() === curMonth;
      return isOverdue || isThisMonth;
    })
    .sort((a, b) => {
      const da = new Date(a.dueDate).getTime();
      const db = new Date(b.dueDate).getTime();
      const oa = da < today.getTime();
      const ob = db < today.getTime();
      if (oa !== ob) return oa ? -1 : 1;
      if (oa && ob) return da - db; // overdue: oldest first (most overdue)
      return da - db;
    })
    .map((item) => ({
      ...item,
      status: item.overdue ? 'OVERDUE' : item.status,
    }));
}
