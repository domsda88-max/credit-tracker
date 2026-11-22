import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FloatingNav } from './FloatingNav';
import { OfflineBanner } from './OfflineBanner';
import {
  useOfflineQueue,
  getOfflineActions,
  OFFLINE_QUEUE_CHANGED,
} from '../hooks/useOfflineQueue';
import { Onboarding } from './Onboarding';
import { useOnboarding } from '../hooks/useOnboarding';

export function Layout() {
  const { syncAll } = useOfflineQueue();
  const [offlineCount, setOfflineCount] = useState(0);
  const showOnboarding = useOnboarding();
  const location = useLocation();

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
    window.addEventListener(OFFLINE_QUEUE_CHANGED, updateCount);
    window.addEventListener('online', updateCount);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_CHANGED, updateCount);
      window.removeEventListener('online', updateCount);
    };
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

        <main className="page min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
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
