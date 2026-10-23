import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreditListItem } from '../types';
import { describeDueDate, formatDate, formatMoney } from '../utils/format';

interface Props {
  credits: CreditListItem[];
}

interface Item {
  creditId: string;
  creditName: string;
  dueDate: string;
  amount: number;
  /** true — платёж был в прошлом (просрочен или уже должен был пройти). */
  overdue: boolean;
}

const COLLAPSE_KEY = 'upcomingPaymentsCollapsed';

/**
 * Ближайшие платежи по всем кредитам одним списком —
 * чтобы видеть «что и когда платить», не открывая каждый кредит.
 * Список можно свернуть/развернуть, состояние запоминается.
 */
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
        // localStorage может быть недоступен — просто игнорируем
      }
      return next;
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: Item[] = credits
    .filter((c) => c.status === 'ACTIVE' && c.nextPayment)
    .map((c) => ({
      creditId: c.id,
      creditName: c.name,
      dueDate: c.nextPayment!.dueDate,
      amount: Number(c.nextPayment!.amount),
      overdue: new Date(c.nextPayment!.dueDate).getTime() < today.getTime(),
    }))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-medium uppercase tracking-wide text-t3">
          Ближайшие платежи
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular text-xs text-t3">
            {items.length} · {formatMoney(total)}
          </span>
          <span
            className={`text-t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            aria-hidden="true"
          >
            ⌄
          </span>
        </span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-card border border-line bg-surface">
          {items.map((item) => (
            <Link
              key={item.creditId}
              to={`/credits/${item.creditId}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition active:bg-surface2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-t1">{item.creditName}</p>
                <p className="text-xs text-t3">
                  {formatDate(item.dueDate)} ·{' '}
                  <span className={item.overdue ? 'text-danger' : 'text-t3'}>
                    {describeDueDate(item.dueDate)}
                  </span>
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold text-t1">
                {formatMoney(item.amount)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
