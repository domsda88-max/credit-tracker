import { CheckCircle2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ToastContext } from './useToast';
import type { ToastKind } from './useToast';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
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
            className={`pointer-events-auto w-full max-w-sm rounded-card border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              t.kind === 'success'
                ? 'border-success/30 bg-success/15 text-success-fg'
                : t.kind === 'error'
                  ? 'border-danger/30 bg-danger/15 text-danger-fg'
                  : 'border-primary/30 bg-primary/15 text-primary-fg'
            }`}
          >
            {t.kind === 'success' && <CheckCircle2 size={14} className="mr-1 inline-block" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
