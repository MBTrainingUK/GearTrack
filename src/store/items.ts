import { useEffect } from 'react';
import { create } from 'zustand';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/useAuth';
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

let startedOrgId: string | null = null;
let unsubscribe: (() => void) | null = null;

// One app-wide listener on the items collection (scoped to the signed-in
// user's org), shared by every screen, instead of each page opening its
// own subscription.
function startItemsListener(orgId: string) {
  if (startedOrgId === orgId) return;
  unsubscribe?.();
  startedOrgId = orgId;
  useItemsStore.setState({ items: [], byId: {}, loaded: false });
  unsubscribe = onSnapshot(
    query(collection(db, 'items'), where('orgId', '==', orgId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      const byId: Record<string, Item> = {};
      items.forEach((i) => { byId[i.id] = i; });
      useItemsStore.setState({ items, byId, loaded: true });
    },
    () => {
      // Listener dies on sign-out (permission-denied); allow a restart
      // next time a screen mounts after signing back in.
      startedOrgId = null;
    }
  );
}

export function useItems() {
  const { appUser } = useAuth();
  useEffect(() => {
    if (appUser?.orgId) startItemsListener(appUser.orgId);
  }, [appUser?.orgId]);
  return useItemsStore();
}
