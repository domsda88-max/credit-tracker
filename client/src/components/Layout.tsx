import { Home, Plus, Settings } from 'lucide-react';
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary/15 text-heading font-bold text-primary">
            ₽
          </div>
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-t1">Credit Tracker</p>
            <p className="truncate text-caption text-t3">{user?.email}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 pr-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-control px-2 py-2 text-caption font-medium text-t3 transition-colors hover:text-t2 active:bg-surface2"
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Единственная прокручиваемая область приложения */}
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-2 [-webkit-overflow-scrolling:touch]">
        <Outlet />
      </main>

      <nav className="flex shrink-0 items-stretch justify-around border-t border-line bg-surface/80 backdrop-blur-xl pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center gap-1 rounded-control px-2 py-1 text-micro font-medium transition-colors duration-200',
                isActive ? 'text-primary' : 'text-t3',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.4 : 2}
                  className="transition-all duration-[350ms] ease-app"
                  style={{
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    opacity: isActive ? 1 : 0.7,
                  }}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
