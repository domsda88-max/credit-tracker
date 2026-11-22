import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';
import { httpStatus } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  /** Проверяет сохранённый токен через /auth/me. Возвращает true, если сессия жива. */
  restoreSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      async login(email, password) {
        const { user, token } = await authApi.login({ email, password });
        set({ user, token, isAuthenticated: true });
      },

      async register(email, password, name) {
        const { user, token } = await authApi.register({ email, password, name });
        set({ user, token, isAuthenticated: true });
      },

      logout() {
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser(user) {
        set({ user });
      },

      async restoreSession() {
        const token = get().token;
        if (!token) {
          set({ user: null, token: null, isAuthenticated: false });
          return false;
        }

        try {
          const user = await authApi.me();
          set({ user, token, isAuthenticated: true });
          return true;
        } catch (error) {
          if (httpStatus(error) === 401) {
            set({ user: null, token: null, isAuthenticated: false });
            return false;
          }
          // Сеть/500: сохраняем последнюю известную сессию, чтобы временный
          // сбой сервера не выгонял пользователя из приложения.
          return Boolean(get().token && get().user);
        }
      },
    }),
    { name: 'credit-tracker-auth' },
  ),
);
