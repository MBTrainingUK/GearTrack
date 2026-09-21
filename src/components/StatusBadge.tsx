import type { ItemStatus, ReservationStatus, CheckoutStatus } from '../types';

const itemColors: Record<ItemStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  checked_out: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
};

const reservationColors: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  checked_out: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  completed: 'bg-surface-hover text-ink-body',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  declined: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
};

const checkoutColors: Record<CheckoutStatus, string> = {
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  returned: 'bg-surface-hover text-ink-body',
  declined: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
};

const labels: Record<string, string> = {
  available: 'Available',
  checked_out: 'Checked Out',
  pending: 'Pending',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  active: 'Checked Out',
  overdue: 'Overdue',
  returned: 'Returned',
  pending_approval: 'Awaiting Approval',
  declined: 'Declined',
};

interface Props {
  status: ItemStatus | ReservationStatus | CheckoutStatus;
  type?: 'item' | 'reservation' | 'checkout';
  className?: string;
}

export default function StatusBadge({ status, type = 'item', className = '' }: Props) {
  const colorMap =
    type === 'reservation'
      ? reservationColors
      : type === 'checkout'
      ? checkoutColors
      : itemColors;

  const colors = (colorMap as Record<string, string>)[status] ?? 'bg-surface-hover text-ink-body';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors} ${className}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
