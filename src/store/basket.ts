import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuth } from '../context/useAuth';
import { useItems } from './items';
import { useCategories } from './categories';
import { isFlagged, isCategoryExcluded } from '../lib/items';
import type { Item } from '../types';

// A staging area for gear the user is gathering before deciding whether to
// book it for later or take it now. It holds nothing but item ids — every
// rule about what may actually be reserved or checked out still lives in the
// reservation form and the checkout modal, which the basket hands off to.

interface BasketState {
  ids: string[];
  ownerUid: string | null;
}

export const useBasketStore = create<BasketState>(() => ({
  ids: [],
  ownerUid: null,
}));

const STORAGE_PREFIX = 'geartrack:basket:';

function storageKey(uid: string) {
  return `${STORAGE_PREFIX}${uid}`;
}

// Storage can throw outright in private browsing or when the quota is full,
// and a basket is never worth failing a render over.
function readStored(uid: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(uid: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(ids));
  } catch {
    // Basket simply won't survive a refresh; nothing else is affected.
  }
}

function setIds(next: string[]) {
  const { ownerUid } = useBasketStore.getState();
  useBasketStore.setState({ ids: next });
  if (ownerUid) writeStored(ownerUid, next);
}

// Tracked outside the store so a sign-out can be told apart from the brief
// null the auth context reports while it is still resolving on boot.
let activeUid: string | null = null;

function syncOwner(uid: string | null) {
  if (uid === activeUid) return;
  if (activeUid && !uid) {
    // An explicit sign-out. The basket is personal, so it must not be waiting
    // for whoever signs in next on a shared machine.
    try {
      localStorage.removeItem(storageKey(activeUid));
    } catch {
      // Nothing to do — the in-memory reset below is the part that matters.
    }
  }
  activeUid = uid;
  useBasketStore.setState({ ownerUid: uid, ids: uid ? readStored(uid) : [] });
}

export function addToBasket(id: string) {
  const { ids } = useBasketStore.getState();
  if (ids.includes(id)) return;
  setIds([...ids, id]);
}

export function removeFromBasket(id: string) {
  const { ids } = useBasketStore.getState();
  if (!ids.includes(id)) return;
  setIds(ids.filter((x) => x !== id));
}

export function toggleBasketItem(id: string) {
  const { ids } = useBasketStore.getState();
  setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
}

// Called once a reservation or checkout has actually been created, so gear
// that has just been booked doesn't sit in the basket waiting to be booked
// again. Harmless for ids that were never in the basket.
export function removeManyFromBasket(toRemove: string[]) {
  const { ids } = useBasketStore.getState();
  const next = ids.filter((id) => !toRemove.includes(id));
  if (next.length !== ids.length) setIds(next);
}

export function clearBasket() {
  setIds([]);
}

export interface BasketContents {
  // Basket items resolved against live inventory, in the order they were added.
  entries: Item[];
  ids: string[];
  count: number;
  // The subset that could be taken this minute — what "Check out now" acts on.
  availableNow: Item[];
}

export function useBasket(): BasketContents {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? null;
  const { byId, loaded } = useItems();
  const { excludedCategories } = useCategories();
  const ids = useBasketStore((s) => s.ids);

  useEffect(() => {
    syncOwner(uid);
  }, [uid]);

  // Inventory moves underneath a basket that outlives a refresh: an item can be
  // deleted, flagged as damaged, or have its whole category made non-bookable
  // while it sits there. Drop those rather than letting them fail at the far
  // end of a booking the user has already filled in.
  useEffect(() => {
    if (!loaded) return;
    const keep = ids.filter((id) => {
      const item = byId[id];
      return Boolean(item) && !isFlagged(item) && !isCategoryExcluded(item, excludedCategories);
    });
    if (keep.length !== ids.length) setIds(keep);
  }, [loaded, ids, byId, excludedCategories]);

  const entries = ids
    .map((id) => byId[id])
    .filter((item): item is Item => Boolean(item));

  return {
    entries,
    ids: entries.map((i) => i.id),
    count: entries.length,
    availableNow: entries.filter((i) => i.status === 'available'),
  };
}
