import { createContext, useCallback, useContext, useState } from 'react';

type ToastKind = 'primary' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'primary') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(4.5rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-surface/95 px-4 py-3 text-sm shadow-lg backdrop-blur-xl ${
              t.kind === 'primary'
                ? '!border-primary/30 !bg-primary/15 text-primary'
                : t.kind === 'error'
                  ? '!border-critical/30 !bg-critical/15 text-critical'
                  : 'text-t1'
            }`}
          >
            {t.kind === 'primary' ? '✅ ' : t.kind === 'error' ? '⚠️ ' : 'ℹ️ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast должен использоваться внутри ToastProvider');
  return ctx;
}
