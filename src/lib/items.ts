import type { Item } from '../types';
import { differenceInMonths } from 'date-fns';

export function isCategoryExcluded(item: Item, excludedCategories: string[]): boolean {
  return excludedCategories.includes(item.category);
}

export interface CategoryOption {
  name: string;
  count: number;
}

// Category options for an item picker, built from the items actually on offer
// rather than from the org's full category list — so choosing a category can
// never leave the picker empty. `keep` is the caller's current selection,
// retained at a count of zero so the dropdown never discards its own value
// while the user is typing in the search box alongside it.
export function categoryOptions(items: Item[], keep?: string): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.category?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (keep && keep !== 'All' && !counts.has(keep)) counts.set(keep, 0);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Items needing inspection or repair are blocked from booking and checkout
// everywhere — desktop and mobile. 'attention_needed' (minor damage, still
// usable) is informational only and does not block.
export function isFlagged(item: Item): boolean {
  return (
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
