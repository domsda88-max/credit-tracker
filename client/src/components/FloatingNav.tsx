import { BarChart3, CalendarDays, CreditCard, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const ITEMS: NavItem[] = [
  { path: '/', icon: LayoutDashboard, label: 'Обзор' },
  { path: '/payments', icon: CalendarDays, label: 'Платежи' },
  { path: '/debts', icon: CreditCard, label: 'Долги' },
  { path: '/stats', icon: BarChart3, label: 'Аналитика' },
];

interface FloatingNavProps {
  offlineCount?: number;
}

export function FloatingNav({ offlineCount = 0 }: FloatingNavProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const hideOnForm = pathname === '/credits/new' || pathname === '/import';

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    if (path === '/debts') return pathname === '/debts' || pathname.startsWith('/credits/');
    if (path === '/payments') return pathname.startsWith('/payments');
    if (path === '/stats') return pathname.startsWith('/stats');
    return pathname === path;
  };

  if (hideOnForm) return null;

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+10px)] left-1/2 z-[60] w-[min(94vw,430px)] -translate-x-1/2"
    >
      <div className="grid grid-cols-4 items-center gap-1 rounded-[28px] border border-line/70 bg-surface/90 p-2 shadow-[var(--shadow-tabbar)] backdrop-blur-2xl">
        {ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          const showOffline = path === '/debts' && offlineCount > 0;
          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(path)}
              className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 transition-all duration-200 active:scale-[0.97] ${
                active ? 'bg-primary/12 text-primary-fg' : 'text-t2 hover:bg-surface2/70 hover:text-t1'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
              {showOffline && (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-line bg-danger-strong px-1 text-[9px] font-bold leading-none text-bg">
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
