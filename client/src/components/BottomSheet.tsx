import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<{ y: number; active: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    const panel = panelRef.current;
    if (!panel || panel.scrollTop !== 0) return;
    dragStart.current = { y: e.touches[0].clientY, active: true };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragStart.current?.active) return;
    const dy = e.touches[0].clientY - dragStart.current.y;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 90) {
      onClose();
    }
    dragStart.current = null;
    setDragY(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-t-[20px] border-t border-line bg-surface p-4 pb-8 safe-area-bottom touch-manipulation animate-sheet-up"
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-surface2" />
        {title && <p className="px-4 pb-2 text-center text-sm font-medium text-t1">{title}</p>}
        <div className="px-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}