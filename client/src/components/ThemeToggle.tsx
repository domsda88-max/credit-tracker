import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store/theme';

const LABELS = {
  light: { Icon: Sun, text: 'Светлая' },
  dark: { Icon: Moon, text: 'Тёмная' },
} as const;

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const cycle = useThemeStore((s) => s.cycle);
  const { Icon, text } = LABELS[mode];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Тема: ${text}. Нажмите, чтобы переключить.`}
      aria-label={`Тема: ${text}`}
      className="shrink-0 rounded-control p-2 text-t2 transition-colors hover:text-t1 active:bg-surface2"
    >
      <Icon size={20} className="transition-transform duration-300 ease-app" />
    </button>
  );
}
