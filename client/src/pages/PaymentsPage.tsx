import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { creditsApi } from '../api/credits';
import { StatusBadge } from '../components/StatusBadge';
import { daysUntil, describeDueDate, formatDateShort, formatMoney } from '../utils/format';
import { getUpcomingPayments, type UpcomingPaymentItem } from '../utils/upcoming';

function LoadingScreen() {
  return (
    <div className="page-stack">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-28 rounded-card" />
      ))}
    </div>
  );
}

function PaymentRow({ item }: { item: UpcomingPaymentItem }) {
  const tone = daysUntil(item.dueDate) < 0 ? 'text-danger-fg' : 'text-t2';
  return (
    <Link
      to={`/credits/${item.creditId}`}
      className="payment-row flex items-center gap-3 px-5 py-3.5 hover:bg-surface2/60 active:bg-surface2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-t1">{item.creditName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-caption ${tone}`}>
            {formatDateShort(item.dueDate)} · {describeDueDate(item.dueDate)}
          </span>
          <StatusBadge status={item.status} />
        </div>
      </div>
      <span className={`tabular shrink-0 text-body font-semibold ${tone}`}>
        {formatMoney(item.amount)}
      </span>
      <ChevronRight size={16} className="shrink-0 text-t3" aria-hidden="true" />
    </Link>
  );
}

export function PaymentsPage() {
  const {
    data: credits,
    isPending,
    error,
  } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (isPending && !credits) return <LoadingScreen />;
  if (error) {
    return <p className="text-sm text-danger-fg">Не удалось загрузить данные: {(error as Error).message}</p>;
  }

  const list = credits ?? [];
  const items = getUpcomingPayments(list);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcomingIds = new Set(items.map((item) => item.creditId));
  const later = list
    .filter(
      (c) =>
        c.status === 'ACTIVE' &&
        c.nextPayment &&
        !upcomingIds.has(c.id) &&
        new Date(c.nextPayment.dueDate).getTime() >= startOfToday.getTime(),
    )
    .map((c) => ({
      creditId: c.id,
      creditName: c.name,
      dueDate: c.nextPayment!.dueDate,
      amount: Number(c.nextPayment!.amount),
      overdue: false,
      status: c.nextPayment!.status,
    }))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="page-stack">
      <section className="card card-enter overflow-hidden">
        <div className="card-pad">
          <p className="section-title">Платежи</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-micro text-t3">На этом месяце</p>
              <p className="tabular mt-1 text-title font-bold text-t1">{formatMoney(total)}</p>
            </div>
            <span className="tabular rounded-chip bg-surface2 px-3 py-1.5 text-caption text-t2">
              {items.length} платежей
            </span>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="card card-pad card-enter text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface2 text-primary-fg">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <p className="mt-3 text-body font-semibold text-t1">Платежей в этом месяце нет</p>
          <p className="mt-1 text-caption text-t3">Запланированные платежи появятся ниже</p>
        </section>
      ) : (
        <section className="card card-enter overflow-hidden">
          <h2 className="section-title px-5 pb-3 pt-5">Ближайшие платежи</h2>
          <div className="divide-y divide-line border-t border-line">
            {items.map((item) => (
              <PaymentRow key={item.creditId} item={item} />
            ))}
          </div>
        </section>
      )}

      {later.length > 0 && (
        <section className="card card-enter overflow-hidden">
          <h2 className="section-title px-5 pb-3 pt-5">Далее по графику</h2>
          <div className="divide-y divide-line border-t border-line">
            {later.slice(0, 12).map((item) => (
              <PaymentRow key={item.creditId} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
