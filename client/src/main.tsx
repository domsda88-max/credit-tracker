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
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const checkUpdate = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      registration.addEventListener('updatefound', () => console.log('[SW] updatefound'));
      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch {
      // игнорируем
    }
  };

  void checkUpdate();
  const interval = setInterval(() => void checkUpdate(), 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkUpdate();
  });
  window.addEventListener('online', () => void checkUpdate());
  window.addEventListener('focus', () => void checkUpdate());
}

