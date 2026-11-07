import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const MENU_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const X_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const HOME_SVG = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PLUS_SVG = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SETTINGS_SVG = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 0-1.82l.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 14.4 9a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ITEMS = [
  { path: '/', icon: HOME_SVG, label: 'Главная' },
  { path: '/credits/new', icon: PLUS_SVG, label: 'Добавить долг' },
  { path: '/settings', icon: SETTINGS_SVG, label: 'Настройки' },
] as const;

export function FloatingNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const pathname = location.pathname;

  // Скрой Speed Dial на странице добавления — у формы своя кнопка закрытия.
  if (pathname === '/credits/new') return null;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    if (path.startsWith('/credits/new')) return pathname.startsWith('/credits/new');
    return pathname === path;
  };

  const handleClose = () => setOpen(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  };

  const handleItemClick = (path: string) => {
    handleClose();
    navigate(path);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[40] bg-black/30 backdrop-blur-sm"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed right-[16px] bottom-[calc(env(safe-area-inset-bottom)+16px)] z-[50] pointer-events-auto"
        onKeyDown={handleKeyDown}
      >
        {/* Дочерние кнопки (раскрываются вверх) */}
        {open && (
          <div className="flex flex-col gap-3 items-end">
            {ITEMS.slice().reverse().map(({ path, icon, label }) => {
              const active = isActive(path);
              const originalIndex = ITEMS.findIndex((i) => i.path === path);
              return (
                <button
                  key={path}
                  type="button"
                  aria-label={label}
                  onClick={() => handleItemClick(path)}
                  className={`h-[48px] w-[48px] rounded-full flex items-center justify-center transition-all duration-300 ${
                    active
                      ? 'bg-accent text-bg shadow-[0_4px_12px_rgb(0_0_0_/_0.25)]'
                      : 'bg-surface/15 text-accent/70 backdrop-blur-sm border border-line'
                  } translate-y-20 scale-80 opacity-0 ${open ? 'translate-y-0 scale-100 opacity-100' : ''}`}
                  style={{ transitionDelay: `${originalIndex * 50}ms` }}
                >
                  {icon}
                </button>
              );
            })}

            {/* Главная кнопка: гамбургер / крестик (в самом низу) */}
            <button
              type="button"
              aria-label={open ? 'Закрыть меню' : 'Открыть навигацию'}
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
              className={`h-[56px] w-[56px] rounded-full flex items-center justify-center transition-all duration-300 ${
                open
                  ? 'bg-accent text-bg rotate-90'
                  : 'bg-surface/15 text-accent backdrop-blur-12 border border-line shadow-[0_8px_30px_rgb(0_0_0_/_0.16)]'
              }`}
            >
              {open ? X_SVG : MENU_SVG}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
