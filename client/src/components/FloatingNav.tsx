import { BarChart3, Home, Landmark, Settings2, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const ITEMS: NavItem[] = [
  { path: '/', icon: Home, label: 'Главная' },
  { path: '/debts', icon: Landmark, label: 'Долги' },
  { path: '/stats', icon: BarChart3, label: 'Аналитика' },
  { path: '/settings', icon: Settings2, label: 'Настройки' },
];

interface FloatingNavProps {
  offlineCount?: number;
}

export function FloatingNav({ offlineCount = 0 }: FloatingNavProps = {}) {
  // Все хуки вызываются безусловно, до раннего return (Rules of Hooks).
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    if (path === '/debts') return pathname === '/debts' || pathname === '/payments' || pathname.startsWith('/credits/');
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const activeIndex = Math.max(0, ITEMS.findIndex(({ path }) => isActive(path)));

  return (
    <nav
      aria-label="Основная навигация"
      className="glass-bar floating-nav fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6px)] left-1/2 z-[60] w-[302px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[20px] border px-2 py-1.5 shadow-nav"
    >
      <div className="floating-nav__items relative grid grid-cols-4 gap-1">
        <span
          aria-hidden="true"
          className="floating-nav__active-pill"
          style={{ transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))` }}
        />
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
              className={`ui-press relative z-10 flex h-[52px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-colors duration-200 ${
                active ? 'text-primary-fg' : 'text-t3 hover:text-t1'
              }`}
            >
              <span
                className={`flex h-6 w-11 items-center justify-center rounded-full transition-all duration-200 ${
                  active ? 'nav-icon-active' : 'bg-transparent'
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}
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
