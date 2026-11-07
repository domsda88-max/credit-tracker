import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store/theme';

const THEMES: Array<{ value: ThemeMode; Icon: React.ElementType; label: string }> = [
  { value: 'light', Icon: Sun, label: 'Светлая' },
  { value: 'warm', Icon: Sun, label: 'Теплая' },
  { value: 'dark', Icon: Moon, label: 'Тёмная' },
] as const;

type ThemeMode = 'light' | 'warm' | 'dark';

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div
      role="segmented-control"
      aria-label="Тема оформления"
      className="flex bg-surface2/60 p-1 rounded-xl border border-line"
    >
      {THEMES.map((theme) => {
        const active = mode === theme.value;
        return (
          <button
            key={theme.value}
            type="button"
            role="segmented-button"
            aria-pressed={active}
            onClick={() => setMode(theme.value)}
            className={`flex-1 items-center justify-center py-2 text-sm rounded-lg transition-colors duration-200 ${
              active
                ? 'bg-surface shadow-sm text-t1'
                : 'text-t3 hover:text-t1 hover:bg-surface2/40'
            }`}
          >
            {active ? (
              <theme.Icon size={16} className="shrink-0" />
            ) : (
              <theme.Icon size={16} className="shrink-0 opacity-60" />
            )}
            <span className="ml-1.5 text-[10px] font-medium leading-none">
              {theme.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
