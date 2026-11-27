import { api } from './client';

export const telegramApi = {
  async status(): Promise<{ linked: boolean }> {
    const { data } = await api.get<{ linked: boolean }>('/telegram/status');
    return data;
  },
  async createLinkCode(): Promise<{ code: string; expiresAt: string }> {
    const { data } = await api.post<{ code: string; expiresAt: string }>('/telegram/link-code');
    return data;
  },
  async unlink(): Promise<void> {
    await api.delete('/telegram/link');
  },
};
