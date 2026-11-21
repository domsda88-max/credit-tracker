import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { paymentsApi } from '../api/payments';
import { StatusBadge } from '../components/StatusBadge';
import type { CreditListItem, InstallmentStatus, PaymentScheduleItem } from '../types';
import { formatDateShort, formatMoney } from '../utils/format';
import { useToast } from '../components/useToast';

type Filter = 'upcoming' | 'paid' | 'all';
type PaymentRow = PaymentScheduleItem & { creditName: string };

function PaymentItem({ item }: { item: PaymentRow }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isOverdue = item.status !== 'PAID' && new Date(item.dueDate).getTime() < new Date(new Date().toDateString()).getTime();
  const status: InstallmentStatus = item.status === 'PAID' ? 'PAID' : isOverdue ? 'OVERDUE' : item.status;
  const mutation = useMutation({
    mutationFn: () => paymentsApi.payInstallment(item.id, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      await queryClient.invalidateQueries({ queryKey: ['credit', item.creditId] });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast.show('Платёж отмечен оплаченным');
    },
    onError: () => toast.show('Не удалось отметить платёж', 'error'),
  });

  return (
    <article className="card card-pad space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/credits/${item.creditId}`} className="truncate text-base font-semibold text-t1 hover:text-primary-fg">
            {item.creditName}
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-t3">
            <CalendarDays size={14} aria-hidden="true" />
            {formatDateShort(item.dueDate)}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="tabular text-xl font-bold tracking-tight text-t1">{formatMoney(item.amount)}</p>
        {status !== 'PAID' ? (
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary/12 px-4 py-2 text-sm font-semibold text-primary-fg transition hover:bg-primary/20 disabled:opacity-50"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            {mutation.isPending ? 'Сохраняем…' : 'Отметить оплаченным'}
          </button>
        ) : (
          <span className="text-xs text-t3">Фактическая оплата учтена</span>
        )}
      </div>
    </article>
  );
}

export function PaymentsPage() {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const { data: credits, isPending, error } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.list(),
    staleTime: 60_000,
  });
  const details = useQueries({
    queries: (credits ?? []).map((credit: CreditListItem) => ({
      queryKey: ['credit', credit.id],
      queryFn: () => creditsApi.getById(credit.id),
      staleTime: 60_000,
    })),
  });

  const items = useMemo(() => {
    const names = new Map((credits ?? []).map((credit) => [credit.id, credit.name]));
    return details.flatMap((query) => (query.data?.schedule ?? []).map((payment) => ({
      ...payment,
      creditName: names.get(payment.creditId) ?? 'Кредит',
    }))).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [credits, details]);

  const visible = items.filter((item) => {
    if (filter === 'paid') return item.status === 'PAID';
    if (filter === 'upcoming') return item.status !== 'PAID';
    return true;
  });
  const pendingCount = items.filter((item) => item.status !== 'PAID').length;
  const paidCount = items.length - pendingCount;
  const detailsLoading = details.some((query) => query.isPending);

  if (isPending || detailsLoading) {
    return <div className="page-stack"><div className="skeleton h-28 rounded-card" /><div className="skeleton h-28 rounded-card" /><div className="skeleton h-28 rounded-card" /></div>;
  }
  if (error) return <p className="card card-pad text-sm text-danger-fg">Не удалось загрузить платежи. Попробуйте обновить страницу.</p>;

  return (
    <div className="page-stack animate-fade-in">
      <header className="space-y-1">
        <p className="section-title">Календарь обязательств</p>
        <h1 className="text-2xl font-bold tracking-tight text-t1">Платежи</h1>
        <p className="text-sm text-t3">Запланированные платежи и уже внесённые суммы</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="card card-pad">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/12 text-warning-fg"><Clock3 size={18} /></span>
          <p className="mt-3 text-xs text-t3">Ожидают оплаты</p>
          <p className="tabular mt-1 text-2xl font-bold text-t1">{pendingCount}</p>
        </div>
        <div className="card card-pad">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/12 text-success-fg"><CheckCircle2 size={18} /></span>
          <p className="mt-3 text-xs text-t3">Оплачено</p>
          <p className="tabular mt-1 text-2xl font-bold text-t1">{paidCount}</p>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface2 p-1.5">
        {([{id:'upcoming',label:'Ожидают'},{id:'paid',label:'Оплачены'},{id:'all',label:'Все'}] as const).map((option) => (
          <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`min-h-10 rounded-xl px-2 text-sm font-semibold transition ${filter===option.id?'bg-surface text-t1 shadow-sm':'text-t3'}`}>
            {option.label}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="space-y-3">{visible.map((item) => <PaymentItem key={item.id} item={item} />)}</div>
      ) : (
        <div className="card flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface2 text-primary-fg"><CalendarDays size={25} /></span>
          <h2 className="text-lg font-semibold text-t1">{filter === 'paid' ? 'Оплаченных платежей пока нет' : 'Здесь пока пусто'}</h2>
          <p className="max-w-xs text-sm text-t3">Когда в графиках кредитов появятся платежи, они отобразятся здесь</p>
        </div>
      )}
    </div>
  );
}
