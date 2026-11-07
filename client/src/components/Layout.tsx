import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { BottomNavigation } from './BottomNavigation';
import { OfflineBanner } from './OfflineBanner';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isDashboard = location.pathname === '/';

  return (
    <>
      <OfflineBanner />
      <div className="mx-auto flex h-[100dvh] w-full max-w-full flex-col overflow-hidden px-4 sm:px-6 relative">
        <main className="page min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <Outlet />
        </main>

        {isDashboard && (
          <button
            type="button"
            aria-label="Добавить долг"
            className="fixed top-[calc(env(safe-area-inset-top)+12px)] right-[16px] z-[60] h-[48px] w-[48px] rounded-full bg-accent text-bg flex items-center justify-center shadow-[0_8px_30px_rgb(0_0_0_/_0.16)] transition-all duration-200 active:scale-[0.95]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}

        <BottomNavigation />
      </div>
    </>
  );
}
