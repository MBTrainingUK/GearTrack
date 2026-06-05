import type { ItemStatus, ReservationStatus, CheckoutStatus } from '../types';

const itemColors: Record<ItemStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  checked_out: 'bg-blue-100 text-blue-800',
  reserved: 'bg-violet-100 text-violet-800',
  maintenance: 'bg-amber-100 text-amber-800',
  flagged: 'bg-red-100 text-red-800',
};

const reservationColors: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  checked_out: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
};

const checkoutColors: Record<CheckoutStatus, string> = {
  active: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-800',
  returned: 'bg-gray-100 text-gray-700',
};

const labels: Record<string, string> = {
  available: 'Available',
  checked_out: 'Checked Out',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
  flagged: 'Flagged',
  pending: 'Pending',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  active: 'Active',
  overdue: 'Overdue',
  returned: 'Returned',
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

  const colors = (colorMap as Record<string, string>)[status] ?? 'bg-gray-100 text-gray-700';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors} ${className}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
