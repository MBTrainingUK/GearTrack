import { startOfDay } from 'date-fns';
import type { Checkout } from '../types';

// A checkout is overdue when it's still active and its due date is before today.
// `overdue` is never persisted as a status — it is always derived from the due date,
// compared at day-level (not millisecond) so same-day returns aren't counted late.
export function isOverdue(c: Checkout): boolean {
  if (c.status !== 'active') return false;
  try {
    return startOfDay(new Date()) > startOfDay(c.dueDate.toDate());
  } catch {
    return false;
  }
}
