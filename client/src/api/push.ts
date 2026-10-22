import type { SubscribePayload } from '../types';
import { api } from './client';

export const pushApi = {
  async getPublicKey(): Promise<string> {
    const { data } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
    return data.publicKey;
  },

  async subscribe(payload: SubscribePayload): Promise<void> {
    await api.post('/push/subscribe', payload);
  },

  async unsubscribe(endpoint: string): Promise<void> {
    await api.delete('/push/subscribe', { data: { endpoint } });
  },

  /** Отправить тестовое уведомление на все устройства пользователя. */
  async sendTest(): Promise<number> {
    const { data } = await api.post<{ ok: boolean; sent: number }>('/push/test');
    return data.sent;
  },
};
