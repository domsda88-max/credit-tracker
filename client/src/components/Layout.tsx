import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { BottomNavigation } from './BottomNavigation';
import { ThemeToggle } from './ThemeToggle';
import { OfflineBanner } from './OfflineBanner';

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

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(128px+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          <Outlet />

        </main>

        <BottomNavigation />
      </div>
    </>
  );
}