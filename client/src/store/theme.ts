import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'credit-tracker-theme';

/** Две темы. Устаревшее значение `warm` мягко мигрирует в светлую. */
function normalize(value: string | null): ThemeMode | null {
  if (value === 'light' || value === 'dark') return value;
  if (value === 'warm') return 'light';
  return null;
}

function readStored(): ThemeMode {
  try {
    const stored = normalize(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      if (stored === 'light' && localStorage.getItem(STORAGE_KEY) === 'warm') {
        localStorage.setItem(STORAGE_KEY, 'light');
      }
      return stored;
    }
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.themeMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readStored();
  return {
    mode: initial,
    resolved: initial,

    setMode: (mode) => {
      apply(mode);
      set({ mode, resolved: mode });
    },

    cycle: () => get().setMode(get().mode === 'light' ? 'dark' : 'light'),
  };
});

export function initTheme(): void {
  apply(useThemeStore.getState().mode);
}
