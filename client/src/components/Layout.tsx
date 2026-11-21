import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Settings2 } from 'lucide-react';
import { FloatingNav } from './FloatingNav';
import { OfflineBanner } from './OfflineBanner';
import { useOfflineQueue, getOfflineActions } from '../hooks/useOfflineQueue';
import { Onboarding } from './Onboarding';
import { useOnboarding } from '../hooks/useOnboarding';

export function Layout() {
  const { syncAll } = useOfflineQueue();
  const [offlineCount, setOfflineCount] = useState(0);
  const showOnboarding = useOnboarding();
  const location = useLocation();
  const navigate = useNavigate();

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
        {/* Лёгкая служебная панель: действия без тяжёлого заголовка */}
        <div
          className="glass-bar relative z-40 flex shrink-0 items-center justify-end gap-1 border-b px-1"
          style={{
            height: 'calc(48px + env(safe-area-inset-top, 0px))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <button
            type="button"
            aria-label="Добавить долг"
            onClick={() => navigate('/credits/new')}
            className="ui-press flex h-10 w-10 items-center justify-center rounded-full text-t2 hover:bg-surface2 hover:text-t1"
          >
            <Plus size={21} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Настройки"
            onClick={() => navigate('/settings')}
            className={`ui-press flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface2 ${
              location.pathname === '/settings' ? 'text-primary-fg' : 'text-t2 hover:text-t1'
            }`}
          >
            <Settings2 size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

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
