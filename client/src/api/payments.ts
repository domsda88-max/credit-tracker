import type { EarlyRepaymentPayload, EarlyPreview } from '../types';
import { api } from './client';

export const paymentsApi = {
  /**
   * «Я оплатил» — отметить платёж по графику.
   * Можно передать фактическую сумму и реальную дату платежа
   * (например, если заплатили меньше или позже).
   */
  async payInstallment(installmentId: string, payload?: { amount?: number; paidAt?: string }) {
    const { data } = await api.post(`/payments/installments/${installmentId}/pay`, payload ?? {});
    return data;
  },

  /** Досрочное погашение (частичное или полное) с пересчётом графика. */
  async earlyRepayment(creditId: string, payload: EarlyRepaymentPayload) {
    const { data } = await api.post(`/payments/credits/${creditId}/early-repayment`, payload);
    return data;
  },

  /** Предпросмотр досрочного погашения: экономия процентов и срока (без записи). */
  async previewEarlyRepayment(creditId: string, payload: EarlyRepaymentPayload): Promise<EarlyPreview> {
    const { data } = await api.post<EarlyPreview>(
      `/payments/credits/${creditId}/early-preview`,
      payload,
    );
    return data;
  },
};
