import type { Item } from '../types';

// Items flagged for attention, inspection, or damage are blocked from
// booking and checkout everywhere — desktop and mobile.
export function isFlagged(item: Item): boolean {
  return (
    item.condition === 'needs_attention' ||
    item.condition === 'needs_investigating' ||
    item.condition === 'damaged'
  );
}
