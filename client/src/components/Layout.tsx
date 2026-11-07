import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { FloatingNav } from './FloatingNav';
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

  return (
    <>
      <OfflineBanner />
      <div className="mx-auto flex h-[100dvh] w-full max-w-full flex-col overflow-hidden px-4 sm:px-6 relative">
        <main className="page min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <Outlet />
        </main>

        {/* Scrim под статус-баром (оставляем) */}
        <div
          className="fixed top-0 left-0 right-0 h-[40px] z-[58] pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, var(--color-bg), transparent)`,
          }}
        />

        <FloatingNav />
      </div>
    </>
  );
}
