import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
    }),
    { name: 'credit-tracker-auth' },
  ),
);
