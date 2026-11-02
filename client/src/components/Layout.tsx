import { Bell, Home, Plus, Settings } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { ThemeToggle } from './ThemeToggle';
import { OfflineBanner } from './OfflineBanner';

const NAV = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/credits/new', label: 'Добавить', icon: Plus, end: false },
  { to: '/settings', label: 'Настройки', icon: Settings, end: false },
] as const;

export function Layout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <OfflineBanner />
      <div className="mx-auto flex h-[100dvh] w-full max-w-full flex-col overflow-hidden px-4 sm:px-6">
        <header className="flex shrink-0 items-center justify-between gap-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary/15 text-heading font-bold text-primary">
              ₽
            </div>
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-t1">Credit Tracker</p>
              <p className="truncate text-caption text-t3">{user?.email}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center">
            <ThemeToggle />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(64px+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/98 backdrop-blur-md">
          <div className="mx-auto flex min-h-[72px] w-full max-w-full items-center justify-around px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-medium transition-colors duration-200',
                    isActive ? 'text-primary' : 'text-t3 active:text-t2',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      className="transition-transform duration-200"
                      style={{
                        transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      }}
                    />
                    <span className="leading-none">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}