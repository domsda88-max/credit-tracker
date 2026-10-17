import type { EarlyRepaymentPayload } from '../types';
import { api } from './client';

export const paymentsApi = {
  /** «Я оплатил» — отметить платёж по графику. */
  async payInstallment(installmentId: string) {
    const { data } = await api.post(`/payments/installments/${installmentId}/pay`);
    return data;
  },

  /** Досрочное погашение (частичное или полное) с пересчётом графика. */
  async earlyRepayment(creditId: string, payload: EarlyRepaymentPayload) {
    const { data } = await api.post(`/payments/credits/${creditId}/early-repayment`, payload);
    return data;
  },
};
