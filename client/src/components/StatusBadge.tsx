import clsx from 'clsx';
import type { InstallmentStatus } from '../types';
import { STATUS_LABELS } from '../utils/format';

const styles: Record<InstallmentStatus, string> = {
  PENDING: 'bg-amber-500/15 text-warning',
  PAID: 'bg-success/15 text-success',
  OVERDUE: 'bg-rose-500/15 text-danger',
};

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
