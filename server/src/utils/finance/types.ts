/** Тип начисления платежей по кредиту. */
export type PaymentType = 'ANNUITY' | 'DIFFERENTIAL' | 'MIN_PAYMENT';

/** Режим пересчёта графика при досрочном погашении. */
export type PrepaymentMode = 'REDUCE_TERM' | 'REDUCE_PAYMENT';

/** Одна строка графика платежей. Все суммы — в рублях (округление до копеек). */
export interface ScheduleItem {
  dueDate: Date;
  amount: number;
  principalPart: number;
  interestPart: number;
}

/** Входные данные для построения графика. */
export interface ScheduleInput {
  type: PaymentType;
  principal: number;
  annualRate: number;
  startDate: Date;
  termMonths: number;
  paymentDay?: number | null;
  minPayment?: number | null;
  gracePeriodEnds?: Date | null;
  graceReplenishSum?: number | null;
  graceReplenishDay?: number | null;
}
