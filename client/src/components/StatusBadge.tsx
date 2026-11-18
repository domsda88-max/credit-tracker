import clsx from 'clsx';
import type { InstallmentStatus } from '../types';
import { STATUS_LABELS } from '../utils/format';

const styles: Record<InstallmentStatus, string> = {
  PENDING: 'bg-warm/15 text-warm',
  PAID: 'bg-primary/15 text-primary',
  OVERDUE: 'bg-critical/15 text-critical',
};

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
