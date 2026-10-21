import { useThemeStore } from '../store/theme';

const LABELS = {
  system: { icon: '🌗', text: 'Как в телефоне' },
  light: { icon: '☀️', text: 'Светлая' },
  dark: { icon: '🌙', text: 'Тёмная' },
} as const;

/**
 * Переключатель темы. Режим «как в телефоне» следует системной настройке iOS/Android,
 * остальные два фиксируют тему вручную. Выбор запоминается.
 */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const cycle = useThemeStore((s) => s.cycle);

  const label = LABELS[mode];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Тема: ${label.text}. Нажмите, чтобы переключить.`}
      aria-label={`Тема: ${label.text}`}
      className="shrink-0 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400 transition active:bg-slate-800/60"
    >
      <span className="text-base leading-none">{label.icon}</span>
    </button>
  );
}
