import { Bell, Home, Plus, Settings } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { ThemeToggle } from './ThemeToggle';

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
    // h-full + overflow-hidden: экран не двигается, скроллится только <main>
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden px-4 sm:px-6">
      <header className="flex shrink-0 items-center justify-between gap-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-heading font-bold text-primary">
            ₽
          </div>
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-t1">Credit Tracker</p>
            <p className="truncate text-caption text-t3">{user?.email}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center pr-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Единственная прокручиваемая область приложения */}
      <main className="animate-fade-in min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(100px+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
        <Outlet />
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-stretch justify-around rounded-full border border-line bg-surface/90 px-2 py-1.5 shadow-lg shadow-black/25 backdrop-blur-xl">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-micro font-semibold transition-all duration-200 active:scale-[0.97]',
                  isActive ? 'bg-primary/15 text-primary' : 'text-t3',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 2}
                    className="transition-all duration-[350ms] ease-app"
                    style={{
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  />
                  <span className={isActive ? '' : 'hidden'}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
