import type { AuthResponse, User } from '../types';
import { api } from './client';

export const authApi = {
  async register(payload: { email: string; password: string; name?: string }): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    return data;
  },

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  async updateSettings(payload: {
    timezone: string;
    reminderHour: number;
    leadDaysList: number[];
    motivationEnabled?: boolean;
    monthlyIncome?: number | null;
  }): Promise<User> {
    const { data } = await api.put<User>('/auth/settings', payload);
    return data;
  },
};
