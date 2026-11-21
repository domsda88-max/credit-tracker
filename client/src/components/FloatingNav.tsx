import { BarChart3, CalendarDays, Home, Landmark, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const ITEMS: NavItem[] = [
  { path: '/', icon: Home, label: 'Обзор' },
  { path: '/payments', icon: CalendarDays, label: 'Платежи' },
  { path: '/debts', icon: Landmark, label: 'Долги' },
  { path: '/stats', icon: BarChart3, label: 'Аналитика' },
];

interface FloatingNavProps {
  offlineCount?: number;
}

export function FloatingNav({ offlineCount = 0 }: FloatingNavProps = {}) {
  // Хуки вызываются безусловно — до любого early return (Rules of Hooks).
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  // На форме добавления долга навигация не нужна.
  if (pathname === '/credits/new') return null;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <nav
      aria-label="Основная навигация"
      className="glass-bar fixed bottom-[calc(env(safe-area-inset-bottom)+6px)] left-1/2 z-[60] -translate-x-1/2 rounded-[20px] border px-2 py-1.5 shadow-nav"
    >
      <div className="flex items-stretch justify-between gap-1">
        {ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          const showOffline = path === '/' && offlineCount > 0;
          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(path)}
              className={`ui-press relative flex h-[52px] w-[66px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 ${
                active ? 'text-primary-fg' : 'text-t3 hover:text-t1'
              }`}
            >
              <span
                className={`flex h-6 w-11 items-center justify-center rounded-full transition-all duration-200 ${
                  active ? 'bg-primary/12' : 'bg-transparent'
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${active ? 'scale-105' : ''}`}
                />
              </span>
              <span className="text-[10px] font-medium leading-none tracking-[-0.01em]">{label}</span>
              {showOffline && (
                <span className="absolute right-2 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-line bg-danger-strong px-1 text-[9px] font-bold leading-none text-bg">
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
