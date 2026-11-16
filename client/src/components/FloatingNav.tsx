import { ChartColumn, Home, Plus, Settings, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const ITEMS: NavItem[] = [
  { path: '/', icon: Home, label: 'Главная' },
  { path: '/credits/new', icon: Plus, label: 'Добавить долг' },
  { path: '/stats', icon: ChartColumn, label: 'Статистика' },
  { path: '/settings', icon: Settings, label: 'Настройки' },
];

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
    return pathname === path;
  };

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+6px)] left-1/2 z-[60] -translate-x-1/2"
    >
      <div className="flex items-center justify-center gap-1 rounded-full border border-line/50 bg-surface/60 p-1.5 shadow-[0_8px_32px_rgb(0_0_0_/_0.18)] backdrop-blur-xl">
        {ITEMS.map(({ path, icon: Icon, label }) => {
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
                  ? 'bg-primary/15 text-primary-fg'
                  : 'text-t3 hover:bg-surface2/70 hover:text-t1'
              }`}
            >
              <Icon
                size={24}
                strokeWidth={active ? 2.4 : 2}
                aria-hidden="true"
                className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}
              />
              {showOffline && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-line bg-danger-strong px-1 text-[10px] font-bold leading-none text-bg">
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
