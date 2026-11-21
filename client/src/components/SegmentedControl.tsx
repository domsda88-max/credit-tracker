import { useCallback, useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../store/theme';

type ThemeMode = 'light' | 'warm' | 'dark';

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'warm', label: 'Warm' },
  { id: 'dark', label: 'Dark' },
];

export function SegmentedControl() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const activeIndex = THEMES.findIndex((t) => t.id === mode);
  const [focusIndex, setFocusIndex] = useState(activeIndex >= 0 ? activeIndex : 0);
  const buttonRefs = useRef<HTMLButtonElement[]>([]);

  useEffect(() => {
    buttonRefs.current[focusIndex]?.focus();
  }, [focusIndex]);

  useEffect(() => {
    setFocusIndex(activeIndex);
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setFocusIndex((prev) => (prev === 0 ? THEMES.length - 1 : prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusIndex((prev) => (prev === THEMES.length - 1 ? 0 : prev + 1));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          setMode(THEMES[index].id);
          setFocusIndex(index);
          break;
        default:
          break;
      }
    },
    [setMode],
  );

  const handleClick = useCallback(
    (index: number) => () => {
      setMode(THEMES[index].id);
      setFocusIndex(index);
    },
    [setMode],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Выбор темы оформления"
      className="flex items-center justify-between gap-1"
    >
      {THEMES.map((t, i) => {
        const isActive = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`Тема ${t.label}`}
            data-state={isActive ? 'checked' : 'unchecked'}
            ref={(el) => {
              if (el) buttonRefs.current[i] = el;
            }}
            tabIndex={isActive ? 0 : -1}
            onClick={handleClick(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`relative flex h-11 w-full items-center justify-center rounded-control bg-transparent px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-primary text-primary-fg'
                : 'text-t2 hover:bg-surface2/50 hover:text-t1'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
