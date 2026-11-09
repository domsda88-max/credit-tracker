import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { FloatingNav } from './FloatingNav';
import { OfflineBanner } from './OfflineBanner';
import { useOfflineQueue, getOfflineActions } from '../hooks/useOfflineQueue';
import { Onboarding } from './Onboarding';
import { useOnboarding } from '../hooks/useOnboarding';

export function Layout() {
  const { syncAll } = useOfflineQueue();
  const [offlineCount, setOfflineCount] = useState(0);
  const showOnboarding = useOnboarding();

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

        <FloatingNav offlineCount={offlineCount} />
      </div>
    </>
  );
}
