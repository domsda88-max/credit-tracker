import axios from 'axios';
import { useAuthStore } from '../store/auth';

/** Дополнительные флаги запроса: фоновые проверки не должны разлогинивать. */
declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthLogout?: boolean;
  }
}

/** Единый axios-инстанс: baseURL + Bearer-токен + точечный авто-разлогин на 401. */
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
    const url = error.config?.url ?? '';
    const isAuthEntryPoint = /\/auth\/(login|register)$/.test(url);
    const isBackgroundRead = error.config?.method?.toLowerCase() === 'get';
    const explicitlySkipped = error.config?.skipAuthLogout === true;

    // 401 от фоновой проверки/превью или разовый сбой /auth/me не должны
    // уничтожать рабочую сессию. Истинную невалидность токена решает restoreSession.
    if (
      error.response?.status === 401 &&
      !isAuthEntryPoint &&
      !isBackgroundRead &&
      !explicitlySkipped
    ) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

/** Код HTTP-ответа, если он есть (сеть/таймаут возвращают undefined). */
export function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

/** Человекочитаемое сообщение об ошибке из ответа API. */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}
