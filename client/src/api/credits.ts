import type { CreateCreditPayload, Credit, CreditDetail, CreditListItem, CreditSummary, ExportData } from '../types';
import { api } from './client';

export const creditsApi = {
  async list(): Promise<CreditListItem[]> {
    const { data } = await api.get<CreditListItem[]>('/credits');
    return data;
  },

  async summary(): Promise<CreditSummary> {
    const { data } = await api.get<CreditSummary>('/credits/summary');
    return data;
  },

  async exportData(): Promise<ExportData> {
    const { data } = await api.get<ExportData>('/credits/export');
    return data;
  },

  async create(payload: CreateCreditPayload): Promise<Credit> {
    const { data } = await api.post<Credit>('/credits', payload);
    return data;
  },

  async getById(id: string): Promise<CreditDetail> {
    const { data } = await api.get<CreditDetail>(`/credits/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<CreateCreditPayload>): Promise<Credit> {
    const { data } = await api.put<Credit>(`/credits/${id}`, payload);
    return data;
  },

  async toggleFreeze(id: string, frozen: boolean): Promise<Credit> {
    const { data } = await api.post<Credit>(`/credits/${id}/freeze`, { frozen });
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/credits/${id}`);
  },
};
