import type { Item } from '../types';
import { differenceInMonths } from 'date-fns';

// Items flagged for attention, inspection, or damage are blocked from
// booking and checkout everywhere — desktop and mobile.
export function isFlagged(item: Item): boolean {
  return (
    item.condition === 'needs_attention' ||
    item.condition === 'needs_investigating' ||
    item.condition === 'damaged'
  );
}

export interface LifespanStatus {
  ageMonths: number;
  pct: number; // uncapped — cap only for display, never for sorting
  monthsRemaining: number; // negative once overdue
  isDue: boolean; // pct >= 100
  isAwaitingReset: boolean; // isDue && already flagged, waiting on a physical inspection
}

// Returns null when the item has no lifespan tracking configured.
export function getLifespanStatus(item: Item): LifespanStatus | null {
  if (!item.purchaseDate || !item.expectedLifespanMonths || item.expectedLifespanMonths <= 0) return null;
  const startDate = (item.lifespanResetDate ?? item.purchaseDate).toDate();
  const ageMonths = Math.max(0, differenceInMonths(new Date(), startDate));
  const pct = Math.round((ageMonths / item.expectedLifespanMonths) * 100);
  const isDue = pct >= 100;
  return {
    ageMonths,
    pct,
    monthsRemaining: item.expectedLifespanMonths - ageMonths,
    isDue,
    isAwaitingReset: isDue && item.condition === 'needs_investigating',
  };
}

export function formatMonths(m: number): string {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y > 0 && mo > 0) return `${y} yr${y > 1 ? 's' : ''} ${mo} month${mo > 1 ? 's' : ''}`;
  if (y > 0) return `${y} yr${y > 1 ? 's' : ''}`;
  return `${mo} month${mo !== 1 ? 's' : ''}`;
}
