import { round2 } from './round';

/** Допуск для сравнения денег с копейками. */
const MONEY_EPSILON = 0.01;

export interface PaymentAllocationInput {
  /** Запланированная сумма строки графика. */
  scheduledAmount: number;
  scheduledPrincipal: number;
  scheduledInterest: number;
  /** Уже внесено по этой строке (для повторных частичных оплат). */
  paidBefore: number;
  paidPrincipalBefore: number;
  paidInterestBefore: number;
  paidOverpaymentBefore: number;
  /** Сумма, которую пользователь внёс сейчас. */
  amount: number;
  /** Текущий остаток тела долга по кредиту. */
  outstanding: number;
}

export interface PaymentAllocation {
  /** Деньги, отнесённые к оставшейся части строки графика. */
  rowApplied: number;
  /** Деньги сверх ожидаемой суммы этой строки. */
  rowExcess: number;
  /** Излишек строки, пошедший в погашение тела (если долг ещё есть). */
  principalExtra: number;
  /** Тело и проценты текущего платежа, отнесённые к строке графика. */
  principalDelta: number;
  interestDelta: number;
  /** Тело, которым реально уменьшен outstanding (никогда не меньше нуля). */
  principalToBalance: number;
  /** Деньги сверх остатка долга — НЕ погашение тела. */
  overpayment: number;
  /** Накопленные значения после платежа. */
  totalPaid: number;
  totalPrincipal: number;
  totalInterest: number;
  totalOverpayment: number;
  status: 'PAID' | 'PARTIALLY_PAID';
}

/**
 * Распределяет фактически внесённую сумму между телом, процентами и переплатой.
 *
 * Частичная оплата оставляет строку PARTIALLY_PAID: разница между плановой
 * суммой и paidAmount остаётся в той же строке. Деньги сверх суммы строки,
 * пока есть долг, идут в погашение тела. Только сумма сверх остатка долга
 * считается переплатой и не уменьшает outstanding.
 */
export function allocatePayment(input: PaymentAllocationInput): PaymentAllocation {
  const planned = round2(Math.max(0, input.scheduledAmount));
  const plannedPrincipal = round2(Math.max(0, input.scheduledPrincipal));
  const plannedInterest = round2(Math.max(0, input.scheduledInterest));
  const paidBefore = round2(Math.max(0, input.paidBefore));
  const amount = round2(Math.max(0, input.amount));
  const outstanding = round2(Math.max(0, input.outstanding));

  const remaining = round2(Math.max(0, planned - paidBefore));
  const rowApplied = round2(Math.min(amount, remaining));
  const rowExcess = round2(Math.max(0, amount - rowApplied));

  const rowRatio = planned > 0 ? rowApplied / planned : 0;
  const principalDelta = round2(Math.min(plannedPrincipal, plannedPrincipal * rowRatio));
  const interestDelta = round2(Math.min(plannedInterest, plannedInterest * rowRatio));

  // Сначала закрываем оставшееся тело строки, затем — весь остальной долг.
  const availableAfterRow = round2(Math.max(0, outstanding - principalDelta));
  const principalExtra = round2(Math.min(rowExcess, availableAfterRow));
  const principalToBalance = round2(Math.min(outstanding, principalDelta + principalExtra));

  // Всё, что не пошло ни в тело, ни в проценты по графику, — переплата.
  // Проценты остаются обязательством строки даже при нулевом остатке тела.
  const overpayment = round2(
    Math.max(0, amount - principalToBalance - interestDelta),
  );

  const totalPaid = round2(paidBefore + amount);
  const totalPrincipal = round2(
    Math.max(0, input.paidPrincipalBefore) + principalToBalance,
  );
  const totalInterest = round2(Math.max(0, input.paidInterestBefore) + interestDelta);
  const totalOverpayment = round2(
    Math.max(0, input.paidOverpaymentBefore) + overpayment,
  );

  return {
    rowApplied,
    rowExcess,
    principalExtra,
    principalDelta,
    interestDelta,
    principalToBalance,
    overpayment,
    totalPaid,
    totalPrincipal,
    totalInterest,
    totalOverpayment,
    status: totalPaid >= planned - MONEY_EPSILON ? 'PAID' : 'PARTIALLY_PAID',
  };
}
