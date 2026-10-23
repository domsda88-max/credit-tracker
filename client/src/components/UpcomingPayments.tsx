import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreditListItem } from '../types';
import { describeDueDate, daysUntil, formatDateShort, formatMoney, urgencyTone } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

interface Item {
  creditId: string;
  creditName: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
}

const COLLAPSE_KEY = 'upcomingPaymentsCollapsed';

export function UpcomingPayments({ credits }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);

  const items: Item[] = credits
    .filter((c) => c.status === 'ACTIVE' && c.nextPayment)
    .map((c) => ({
      creditId: c.id,
      creditName: c.name,
      dueDate: c.nextPayment!.dueDate,
      amount: Number(c.nextPayment!.amount),
      overdue: new Date(c.nextPayment!.dueDate).getTime() < today.getTime(),
    }))
    .filter((item) => {
      const d = new Date(item.dueDate);
      return d >= today && d <= horizon;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <p className="section-title">Ближайшие платежи (30 дней)</p>
        <div className="rounded-card border border-line bg-surface p-4 text-center text-caption text-t3">
          Нет платежей в ближайшие 30 дней
        </div>
      </section>
    );
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="section-title">Ближайшие платежи (30 дней)</span>
        <span className="flex items-center gap-2">
          <span className="tabular text-caption text-t3">
            {items.length} · {formatMoney(total)}
          </span>
          <span
            className={`text-t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {items.map((item) => {
            const tone = urgencyTone(daysUntil(item.dueDate));
            const toneClass =
              tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-t2';
            return (
              <Link
                key={item.creditId}
                to={`/credits/${item.creditId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition active:bg-surface2"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-t1">{item.creditName}</p>
                  <p className={`text-caption ${toneClass}`}>
                    {formatDateShort(item.dueDate)} · {describeDueDate(item.dueDate)}
                  </p>
                </div>
                <span className={`tabular shrink-0 text-body font-semibold ${toneClass}`}>
                  {formatMoney(item.amount)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
