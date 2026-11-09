import { useLocation, useNavigate } from 'react-router-dom';

const HOME_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PLUS_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CHART_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <polyline points="3 21 9 12 21 3" />
  </svg>
);

const SETTINGS_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 0-1.82l.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 14.4 9a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const TROPHY_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2V5h12V2" />
    <path d="M7 7h10l-1 4H8l-1-4z" />
    <path d="M4 11h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3z" />
  </svg>
);

const ITEMS = [
  { path: '/', icon: HOME_SVG, label: 'Главная' },
  { path: '/credits/new', icon: PLUS_SVG, label: 'Добавить долг' },
  { path: '/achievements', icon: TROPHY_SVG, label: 'Достижения' },
  { path: '/stats', icon: CHART_SVG, label: 'Статистика' },
  { path: '/settings', icon: SETTINGS_SVG, label: 'Настройки' },
] as const;

interface FloatingNavProps {
  offlineCount?: number;
}

export function FloatingNav({ offlineCount = 0 }: FloatingNavProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;

  if (pathname === '/credits/new') return null;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    if (path === '/stats') return pathname.startsWith('/stats');
    if (path === '/achievements') return pathname.startsWith('/achievements');
    return pathname === path;
  };

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-1/2 z-[60] -translate-x-1/2"
    >
      <div className="flex items-center justify-center gap-1 rounded-full border border-line bg-surface/95 p-1.5 shadow-[0_10px_40px_rgb(0_0_0_/_0.20)] backdrop-blur-md">
        {ITEMS.map(({ path, icon, label }) => {
          const active = isActive(path);
          const showOffline = path === '/settings' && offlineCount > 0;
          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(path)}
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                active
                  ? 'bg-accent text-bg'
                  : 'text-t3 hover:bg-surface2 hover:text-t1'
              }`}
            >
              {icon}
              {showOffline && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-line bg-danger px-1 text-[10px] font-bold leading-none text-bg">
                  {offlineCount > 9 ? '9+' : offlineCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
