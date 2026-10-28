export type CreditType = 'CREDIT_CARD' | 'CONSUMER' | 'MORTGAGE' | 'INSTALLMENT' | 'MICROLOAN' | 'LOAN';
export type PaymentType = 'ANNUITY' | 'DIFFERENTIAL' | 'MIN_PAYMENT';
export type PrepaymentMode = 'REDUCE_TERM' | 'REDUCE_PAYMENT';
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
  /** ����� � �����, ?. null � �� �����. */
  monthlyIncome: number | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/** �������� ���� �������� � ���� ��� ������ (Prisma Decimal). */
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

/** ������� ����������� ��������� (�+N ? � ����� ������� ����). */
export interface PayoffAccelerator {
  baselineMonths: number;
  acceleratedMonths: number;
  savedMonths: number;
  targetName: string;
  extraPerMonth: number;
}

/** ������ �� ���� �������� (GET /credits/summary). */
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
  /** ����� ����������� ������������ �������� �� ���� �������� ������. */
  monthlyPayments: number;
  /** ����� � ����� (null � �� ����� � ����������). */
  monthlyIncome: number | null;
  /** ��������� ������ = ����� ? ����������� �������. */
  freeMoney: number | null;
  graceReplenishTotal: number;
  graceItems: { name: string; amount: number; dueDate: string | null }[];
  accelerator: PayoffAccelerator | null;
}

export interface CreditDetail extends Credit {
  schedule: PaymentScheduleItem[];
  events: PaymentEvent[];
}

/** ������� ���� ������ ������������ (GET /credits/export). */
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
  /** true � ��������� �� ������� ������� ����� �������� ����������� (������ �������� ������). */
  markPastAsPaid?: boolean;
  /** ����������� ������� ����� ������ (���� �������� ������ �������). */
  outstanding?: number | null;
}

export interface EarlyRepaymentPayload {
  amount: number;
  mode?: PrepaymentMode;
  note?: string;
  date?: string;
}

/** ��������� ������������� ���������� ��������� (POST /payments/credits/:id/early-preview). */
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
}

export interface SubscribePayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
