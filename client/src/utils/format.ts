import type { CreditType, InstallmentStatus, PaymentType } from '../types';

/** 12345.6 → «12 345,60 ₽» */
export function formatMoney(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return `${num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

/** Компактно: 1 234 567 → «1,23 млн ₽» */
export function formatMoneyShort(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2).replace('.', ',')} млн ₽`;
  if (Math.abs(num) >= 10_000) return `${(num / 1_000).toFixed(1).replace('.', ',')} тыс. ₽`;
  return formatMoney(num);
}

/** ISO-дата → «15.02.2025» */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Сколько дней до даты (отрицательное — просрочка). */
export function daysUntil(value: string | Date): number {
  const target = typeof value === 'string' ? new Date(value) : value;
  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const n = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((t - n) / msPerDay);
}

/** Человеческий срок: «через 3 дня», «сегодня», «просрочка 2 дня». */
export function describeDueDate(value: string | Date): string {
  const diff = daysUntil(value);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff > 1) return `через ${diff} дн.`;
  const overdue = Math.abs(diff);
  return `просрочка ${overdue} дн.`;
}

/** Процент погашения по ТЕЛУ долга: сколько долга уже закрыто.
 *  Раньше считали от totalPaid (вместе с процентами) — это давало завышенный процент. */
export function debtPaidPercent(
  principal: string | number,
  outstanding: string | number,
): number {
  const p = Number(principal);
  if (p <= 0) return 100;
  const left = Number(outstanding);
  const paid = Math.max(0, p - left);
  return Math.min(100, Math.round((paid / p) * 100));
}

/** Процент погашения от первоначальной суммы (оставлен для совместимости). */
export function paidPercent(totalPaid: string | number, principal: string | number): number {
  const p = Number(principal);
  if (p <= 0) return 100;
  return Math.min(100, Math.round((Number(totalPaid) / p) * 100));
}

export const CREDIT_TYPE_LABELS: Record<CreditType, string> = {
  CREDIT_CARD: 'Кредитная карта',
  CONSUMER: 'Потребительский кредит',
  MORTGAGE: 'Ипотека',
  INSTALLMENT: 'Рассрочка / Сплит',
  MICROLOAN: 'Займ (МФО)',
  LOAN: 'Заем (частный)',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ANNUITY: 'Аннуитетный',
  DIFFERENTIAL: 'Дифференцированный',
  MIN_PAYMENT: 'Минимальный платёж (кредитка)',
};

export const STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: 'Ожидает',
  PAID: 'Оплачен',
  OVERDUE: 'Просрочен',
};
