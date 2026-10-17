import axios from 'axios';
import { useAuthStore } from '../store/auth';

/** Единый axios-инстанс: baseURL + Bearer-токен + авто-разлогин на 401. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

/** Человекочитаемое сообщение об ошибке из ответа API. */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}
