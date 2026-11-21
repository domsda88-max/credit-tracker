import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import type { CreditListItem } from '../types';
import { daysUntil, describeDueDate, formatDateShort, formatMoney, urgencyTone } from '../utils/format';
import { getUpcomingPayments } from '../utils/upcoming';
import { StatusBadge } from './StatusBadge';

interface Props {
  credits: CreditListItem[];
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

  const items = getUpcomingPayments(credits);

  if (items.length === 0) {
    return (
      <section className="card card-enter overflow-hidden">
        <div className="card-pad">
          <p className="section-title">Ближайшие платежи</p>
          <div className="mt-4 flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface2 text-primary-fg">
              <CalendarDays size={22} aria-hidden="true" />
            </span>
            <p className="mt-3 text-body font-semibold text-t1">Платежей в этом месяце нет</p>
            <p className="mt-1 text-caption text-t3">
              Когда появятся новые платежи, они будут здесь
            </p>
          </div>
        </div>
      </section>
    );
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="card card-enter overflow-hidden" aria-labelledby="upcoming-payments-title">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p id="upcoming-payments-title" className="section-title">
            Ближайшие платежи
          </p>
          <p className="mt-1.5 text-caption text-t2">
            <span className="tabular font-medium text-t1">{items.length}</span> ·{' '}
            <span className="tabular font-semibold text-t1">{formatMoney(total)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Показать ближайшие платежи' : 'Скрыть ближайшие платежи'}
          className="ui-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-t2"
        >
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
      </div>

      <div className="acc" data-open={!collapsed}>
        <div className="acc__inner">
          <div className="divide-y divide-line border-t border-line">
            {items.map((item) => {
              const tone = urgencyTone(daysUntil(item.dueDate));
              const toneClass =
                tone === 'danger' ? 'text-danger-fg' : tone === 'warm' ? 'text-warm-fg' : 'text-t2';
              return (
                <Link
                  key={item.creditId}
                  to={`/credits/${item.creditId}`}
                  className="upcoming-row payment-row flex items-center gap-3 px-5 py-3.5 hover:bg-surface2/60 active:bg-surface2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-t1">{item.creditName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`tabular text-caption ${toneClass}`}>
                        {formatDateShort(item.dueDate)} · {describeDueDate(item.dueDate)}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`tabular text-body font-semibold ${toneClass}`}>
                      {formatMoney(item.amount)}
                    </span>
                    <ChevronRight size={16} className="text-t3" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
