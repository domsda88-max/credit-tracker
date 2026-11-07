import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { BottomNavigation } from './BottomNavigation';
import { OfflineBanner } from './OfflineBanner';
import { useEffect, useRef, useState } from 'react';

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

  // FAB: скрывать при скролле вниз, показывать при скролле вверх / остановке (как в Telegram).
  const [fabVisible, setFabVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 40) {
        setFabVisible(false);
      } else if (y < lastScrollY.current) {
        setFabVisible(true);
      }
      lastScrollY.current = y > 0 ? y : 0;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleFabClick = () => {
    navigate('/credits/new');
  };

  return (
    <>
      <OfflineBanner />
      <div className="mx-auto flex h-[100dvh] w-full max-w-full flex-col overflow-hidden px-4 sm:px-6 relative">
        <main className="page min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <Outlet />
        </main>

        {isDashboard && (
          <>
            <div
              className="fixed top-0 left-0 right-0 h-[40px] z-[58] pointer-events-none"
              style={{
                background: `linear-gradient(to bottom, var(--color-bg), transparent)`,
              }}
            />
            <button
              type="button"
              aria-label="Добавить долг"
              className={`fixed top-[calc(env(safe-area-inset-top)+12px)] right-[16px] z-[60] h-[48px] w-[48px] rounded-full bg-accent text-bg flex items-center justify-center shadow-[0_8px_30px_rgb(0_0_0_/_0.16)] transition-all duration-200 active:scale-[0.95] ${!fabVisible ? 'pointer-events-none opacity-0 translate-y-12' : ''}`}
              onClick={handleFabClick}
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
          </>
        )}

        <BottomNavigation />
      </div>
    </>
  );
}
