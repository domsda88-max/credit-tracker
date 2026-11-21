import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { FloatingNav } from './FloatingNav';
import { OfflineBanner } from './OfflineBanner';
import { useOfflineQueue, getOfflineActions } from '../hooks/useOfflineQueue';
import { Onboarding } from './Onboarding';
import { useOnboarding } from '../hooks/useOnboarding';

export function Layout() {
  const { syncAll } = useOfflineQueue();
  const queryClient = useQueryClient();
  const [offlineCount, setOfflineCount] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const showOnboarding = useOnboarding();
  const location = useLocation();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void queryClient.invalidateQueries();
    };
    const refreshWhenOnline = () => void queryClient.invalidateQueries();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenOnline);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenOnline);
    };
  }, [queryClient]);

  const refreshData = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.currentTarget.scrollTop > 0 || refreshing) return;
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!touchStart.current || refreshing || event.currentTarget.scrollTop > 0) return;
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaX = touch.clientX - touchStart.current.x;
    if (deltaY > 8 && deltaY > Math.abs(deltaX)) {
      if (event.cancelable) event.preventDefault();
      setPullDistance(Math.min(76, deltaY * 0.45));
    }
  };

  const handleTouchEnd = () => {
    touchStart.current = null;
    if (pullDistance >= 65) void refreshData();
    else setPullDistance(0);
  };

  const handleTouchCancel = () => {
    touchStart.current = null;
    setPullDistance(0);
  };

  useEffect(() => {
    const updateCount = async () => {
      try {
        const actions = await getOfflineActions();
        setOfflineCount(actions.length);
      } catch {
        setOfflineCount(0);
      }
    };
    updateCount();
  }, [syncAll]);

  if (showOnboarding) {
    return <Onboarding />;
  }

  return (
    <>
      <OfflineBanner />
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden px-5 sm:px-6">
        {/* Только безопасный отступ под системную строку состояния; действия перенесены в разделы. */}
        <div
          aria-hidden="true"
          className="shrink-0"
          style={{
            height: 'calc(12px + env(safe-area-inset-top, 0px))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        />

        <main
          className="page min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div
            aria-live="polite"
            className="sticky top-0 z-20 flex justify-center overflow-hidden pointer-events-none"
            style={{ height: pullDistance > 0 || refreshing ? 48 : 0, transition: "height 160ms ease" }}
          >
            <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 text-xs text-t2 shadow-sm backdrop-blur">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Обновляем данные…" : pullDistance >= 65 ? "Отпустите для обновления" : "Потяните ещё"}
            </div>
          </div>
          <div key={location.pathname} className="route-enter min-h-full">
            <Outlet />
          </div>
        </main>

        {/* Scrim под статус-баром (только на устройствах с вырезом) */}
        <div
          className="pointer-events-none fixed left-0 right-0 top-0 z-[58]"
          style={{
            height: 'env(safe-area-inset-top, 0px)',
            background: `linear-gradient(to bottom, var(--color-bg), transparent)`,
          }}
        />

        <FloatingNav offlineCount={offlineCount} />
      </div>
    </>
  );
}
