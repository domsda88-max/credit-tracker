import { useEffect, useState } from 'react';
import { BADGES } from '../hooks/useGamification';

interface Props {
  badgeId: string;
  onClose?: () => void;
}

export function BadgeUnlocked({ badgeId, onClose }: Props) {
  const [visible, setVisible] = useState(true);
  const badge = BADGES[badgeId as keyof typeof BADGES];

  useEffect(() => {
    if (!badge || !visible) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 5000);
    return () => window.clearTimeout(t);
  }, [badge, visible, onClose]);

  if (!badge || !visible) return null;

  const colorMap: Record<string, string> = {
    primary: 'border-primary bg-primary/10 text-primary-fg',
    success: 'border-success bg-success/10 text-success-fg',
    warning: 'border-warning bg-warning/10 text-warning-fg',
    danger: 'border-danger bg-danger/10 text-danger-fg',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[70] flex w-full max-w-sm flex-col items-end gap-2 pointer-events-none`}
    >
      <div className={`pointer-events-auto flex w-full items-center gap-3 rounded-card border p-4 shadow-lg ${colorMap[badge.color]}`}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface">
          <span className="text-2xl">{badge.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-t1">Достижение разблокировано!</p>
          <p className="mt-0.5 text-xs text-t3">{badge.title}</p>
          <p className="mt-0.5 text-[10px] text-t3">{badge.description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
          className="shrink-0 rounded-control p-1.5 text-t3 hover:bg-surface2 transition"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
