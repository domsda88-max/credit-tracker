import { useLocation, useNavigate } from 'react-router-dom';

const HOME_SVG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PLUS_SVG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SETTINGS_SVG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

  const pathname = location.pathname;

  // Форма добавления — модальный экран с собственной кнопкой закрытия:
  // нижняя панель там не нужна и перекрывала бы действия формы.
  if (pathname === '/credits/new') return null;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path;
  };

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] left-1/2 z-[50] -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface/85 p-2 shadow-[0_8px_30px_rgb(0_0_0_/_0.16)] backdrop-blur-md">
        {ITEMS.map(({ path, icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(path)}
              className={`flex h-[52px] w-[52px] items-center justify-center rounded-full transition-all duration-200 ${
                active
                  ? 'bg-accent text-bg shadow-[0_4px_12px_rgb(0_0_0_/_0.25)]'
                  : 'text-t3 transition-colors hover:bg-surface2 hover:text-t1'
              }`}
            >
              {icon}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
