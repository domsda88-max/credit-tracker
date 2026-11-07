import { create } from 'zustand';

export type ThemeMode = 'light' | 'warm' | 'dark';

const STORAGE_KEY = 'credit-tracker-theme';

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'warm' || value === 'dark') return value;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function apply(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.themeMode = mode;
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readStored(),
  resolved: readStored(),

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    apply(mode);
    set({ mode, resolved: mode });
  },

  cycle: () => {
    const modes: ThemeMode[] = ['light', 'warm', 'dark'];
    const current = get().mode;
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    get().setMode(next);
  },
}));

export function initTheme(): void {
  apply(useThemeStore.getState().mode);
}
