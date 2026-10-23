import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { initTheme } from './store/theme';
import './index.css';

// Тема ставится до первого рендера — чтобы не мигало белым/тёмным.
initTheme();

console.info('build: a798c67');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// DEBUG: log every query state change
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' || event.type === 'added' || event.type === 'removed') {
    const q = event.query;
    console.log('[RQ]', Date.now(), event.type, JSON.stringify(q.queryKey), 'status=', q.state.status, 'fetchStatus=', q.state.fetchStatus, 'error=', q.state.error?.message);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// PWA: автообновление при новой версии Service Worker.
// Проверяем при старте, раз в минуту, при возврате в приложение и при появлении сети —
// чтобы установленное на рабочий стол приложение не «залипало» на старой версии.
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] controllerchange');
    // Do NOT auto-reload — causes reload loop. User can refresh manually.
  });

  const checkUpdate = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      registration.addEventListener('updatefound', () => console.log('[SW] updatefound'));
      await registration.update();
      // Если уже ждёт новая версия — активируем её немедленно.
      if (registration.waiting) {
        console.log('[SW] waiting -> SKIP_WAITING');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch {
      // игнорируем
    }
  };

  void checkUpdate();
  // Removed setInterval polling to prevent SW update loop
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkUpdate();
  });
  window.addEventListener('online', () => void checkUpdate());
  window.addEventListener('focus', () => void checkUpdate());
}

