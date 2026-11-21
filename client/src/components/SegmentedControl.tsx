import { Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '../store/theme';

const THEMES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Светлая', Icon: Sun },
  { id: 'dark', label: 'Тёмная', Icon: Moon },
];

export function SegmentedControl() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div
      role="radiogroup"
      aria-label="Выбор темы оформления"
      className="grid grid-cols-2 gap-2 rounded-2xl bg-surface2 p-1.5"
    >
      {THEMES.map(({ id, label, Icon }) => {
        const isActive = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setMode(id)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              isActive
                ? 'bg-surface text-t1 shadow-sm'
                : 'text-t2 hover:text-t1'
            }`}
          >
            <Icon size={17} strokeWidth={2.1} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
