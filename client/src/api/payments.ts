import type {
  EarlyRepaymentPayload,
  EarlyPreview,
  ImportPaymentRowPayload,
  ImportPaymentsResult,
  PayInstallmentPayload,
} from '../types';
import { api } from './client';

/** Общий заголовок идемпотентности: сервер читает его даже если тело потерялось. */
function keyConfig(idempotencyKey?: string) {
  return idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined;
}

export const paymentsApi = {
  /**
   * «Я оплатил» — отметить платёж по графику.
   * Можно передать фактическую сумму, реальную дату и ключ идемпотентности.
   */
  async payInstallment(installmentId: string, payload: PayInstallmentPayload = {}) {
    const { data } = await api.post(
      `/payments/installments/${installmentId}/pay`,
      payload,
      keyConfig(payload.idempotencyKey),
    );
    return data;
  },

  /** Отмена оплаты по графику (не путать с удалением строки). */
  async cancelSchedule(installmentId: string) {
    const { data } = await api.post(`/payments/schedule/${installmentId}/cancel`);
    return data;
  },

  async earlyRepayment(creditId: string, payload: EarlyRepaymentPayload) {
    const { data } = await api.post(
      `/payments/credits/${creditId}/early-repayment`,
      payload,
      keyConfig(payload.idempotencyKey),
    );
    return data;
  },

  /** Предпросмотр досрочного погашения: экономия процентов и срока (без записи). */
  async previewEarlyRepayment(creditId: string, payload: EarlyRepaymentPayload): Promise<EarlyPreview> {
    const { data } = await api.post<EarlyPreview>(
      `/payments/credits/${creditId}/early-preview`,
      payload,
      // Фоновый предпросмотр не должен разлогинивать при 401.
      { skipAuthLogout: true },
    );
    return data;
  },

  /** Массовый импорт фактических оплат (round-trip CSV). Возвращает частичный успех. */
  async importPayments(rows: ImportPaymentRowPayload[]): Promise<ImportPaymentsResult> {
    const { data } = await api.post<ImportPaymentsResult>('/payments/import', { rows });
    return data;
  },
};
