import { create } from 'zustand';

/** Режим темы: следует за системой, всегда светлая или всегда тёмная. */
export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'credit-tracker-theme';

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* приватный режим — localStorage может быть недоступен */
  }
  return 'system';
}

/** Итоговая тема с учётом системных настроек телефона. */
function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

/** Проставить тему в <html data-theme> — на этом строятся CSS-переопределения. */
function apply(mode: ThemeMode): void {
  const resolved = resolve(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
}

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  /** Переключить по кругу: system → light → dark → system. */
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readStored(),
  resolved: resolve(readStored()),

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    apply(mode);
    set({ mode, resolved: resolve(mode) });
  },

  cycle: () => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(get().mode) + 1) % order.length];
    get().setMode(next);
  },
}));

/**
 * Инициализация при старте: ставим тему сразу и подписываемся на изменения
 * системной темы (чтобы при режиме «system» интерфейс менялся на лету).
 */
export function initTheme(): void {
  apply(useThemeStore.getState().mode);

  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      const { mode, resolved } = useThemeStore.getState();
      apply(mode);
      const next = resolve(mode);
      if (next !== resolved) useThemeStore.setState({ resolved: next });
    });
  } catch {
    /* старый браузер — просто игнорируем */
  }
}
