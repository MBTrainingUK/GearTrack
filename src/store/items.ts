import { useEffect } from 'react';
import { create } from 'zustand';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Item } from '../types';

interface ItemsState {
  items: Item[];
  byId: Record<string, Item>;
  loaded: boolean;
}

export const useItemsStore = create<ItemsState>(() => ({
  items: [],
  byId: {},
  loaded: false,
}));

let started = false;

// One app-wide listener on the items collection, shared by every screen,
// instead of each page opening its own full-collection subscription.
function startItemsListener() {
  if (started) return;
  started = true;
  onSnapshot(
    collection(db, 'items'),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      const byId: Record<string, Item> = {};
      items.forEach((i) => { byId[i.id] = i; });
      useItemsStore.setState({ items, byId, loaded: true });
    },
    () => {
      // Listener dies on sign-out (permission-denied); allow a restart
      // next time a screen mounts after signing back in.
      started = false;
    }
  );
}

export function useItems() {
  useEffect(() => { startItemsListener(); }, []);
  return useItemsStore();
}
