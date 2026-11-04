export type CreditType = 'CREDIT_CARD' | 'CONSUMER' | 'MORTGAGE' | 'INSTALLMENT' | 'MICROLOAN' | 'LOAN';
export type PaymentType = 'ANNUITY' | 'DIFFERENTIAL' | 'MIN_PAYMENT';
export type PrepaymentMode = 'REDUCE_TERM';
export type CreditStatus = 'ACTIVE' | 'CLOSED';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type PaymentEventKind = 'SCHEDULED' | 'EARLY_PARTIAL' | 'EARLY_FULL' | 'MIN_PAYMENT';

export interface User {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  reminderHour: number;
  leadDaysList: number[];
  motivationEnabled: boolean;
  motivationDay: number;
  motivationTime?: string;
  motivationPerDay?: number;
  /** Monthly income; null when not set. */
  monthlyIncome: number | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/** Money amount stored as string or number (Prisma Decimal). */
export type Money = string | number;

export interface PaymentScheduleItem {
  id: string;
  creditId: string;
  dueDate: string;
  amount: Money;
  principalPart: Money;
  interestPart: Money;
  status: InstallmentStatus;
  paidAt: string | null;
  paidAmount: Money | null;
}

export interface PaymentEvent {
  id: string;
  creditId: string;
  kind: PaymentEventKind;
  amount: Money;
  paidAt: string;
  note: string | null;
}

export interface Credit {
  id: string;
  name: string;
  type: CreditType;
  paymentType: PaymentType;
  prepaymentMode: PrepaymentMode;
  principal: Money;
  outstanding: Money;
  annualRate: Money;
  startDate: string;
  termMonths: number;
  paymentDay: number | null;
  minPayment: Money | null;
  gracePeriodEnds: string | null;
  graceReplenishSum: Money | null;
  graceReplenishDay: number | null;
  frozen: boolean;
  freezeCycleDays: number | null;
  freezeStartedAt: string | null;
  nextFreezeCheckAt: string | null;
  status: CreditStatus;
  closedAt: string | null;
  totalPaid: Money;
  createdAt: string;
}

export interface CreditListItem extends Credit {
  nextPayment: PaymentScheduleItem | null;
}

/** Payoff accelerator summary (+N months earlier debt-free). */
export interface PayoffAccelerator {
  baselineMonths: number;
  acceleratedMonths: number;
  savedMonths: number;
  targetName: string;
  extraPerMonth: number;
}

/** Summary across all credits (GET /credits/summary). */
export interface CreditSummary {
  activeCount: number;
  closedCount: number;
  principalSum: number;
  outstandingSum: number;
  paidByPrincipal: number;
  totalPaidSum: number;
  scheduledTotal: number;
  overpay: number;
  debtFreeDate: string | null;
  paidLast12Months: number;
  paymentsLast12Months: number;
  /** Average monthly payment across all active credits. */
  monthlyPayments: number;
  /** Income per month (null when not set in profile). */
  monthlyIncome: number | null;
  /** Free money = income minus mandatory payments. */
  freeMoney: number | null;
  graceReplenishTotal: number;
  graceItems: { name: string; amount: number; dueDate: string | null }[];
  accelerator: PayoffAccelerator | null;
}

export interface CreditDetail extends Credit {
  schedule: PaymentScheduleItem[];
  events: PaymentEvent[];
}

/** Full data export payload (GET /credits/export). */
export interface ExportData {
  exportedAt: string;
  version: number;
  credits: Array<Credit & { schedule: PaymentScheduleItem[]; events: PaymentEvent[] }>;
}

export interface CreateCreditPayload {
  name: string;
  type: CreditType;
  paymentType: PaymentType;
  prepaymentMode?: PrepaymentMode;
  principal: number;
  annualRate: number;
  startDate: string;
  termMonths?: number;
  termDays?: number;
  paymentDay?: number | null;
  minPayment?: number | null;
  gracePeriodEnds?: string | null;
  graceReplenishSum?: number | null;
  graceReplenishDay?: number | null;
  frozen?: boolean;
  freezeCycleDays?: number | null;
  /** true — mark past payments as paid when importing (backfill the schedule). */
  markPastAsPaid?: boolean;
  /** Current outstanding balance (if the schedule was imported). */
  outstanding?: number | null;
  earlyRepayments?: Array<{ amount: number; date: string }>;
}

export interface EarlyRepaymentPayload {
  amount: number;
  mode?: PrepaymentMode;
  note?: string;
  date?: string;
}

/** Early repayment preview response (POST /payments/credits/:id/early-preview). */
export interface EarlyPreview {
  isFull: boolean;
  amount: number;
  newOutstanding: number;
  monthSaved: number;
  interestSaved: number;
  interestAfter: number;
  totalAfter: number;
  currentTotal?: number;
  paymentBefore: number;
  paymentAfter: number;
  monthsAfter?: number;
  accruedInterest: number;
  principalPart: number;
  days: number;
  coversInterest: boolean;
  minAmount: number;
  effectiveDate: string;
}

export interface SubscribePayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
