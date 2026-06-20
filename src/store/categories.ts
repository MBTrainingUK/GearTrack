import { useEffect } from 'react';
import { create } from 'zustand';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/useAuth';

// Categories shipped with the app. Anything added later via "Add category"
// lives in Firestore and is merged in alongside these.
export const DEFAULT_CATEGORIES = ['Camera', 'Lighting', 'Audio', 'Lens', 'Tripod', 'Computer', 'Memory Card', 'Other'];

interface CategoriesState {
  custom: string[];
  loaded: boolean;
}

export const useCategoriesStore = create<CategoriesState>(() => ({
  custom: [],
  loaded: false,
}));

let startedOrgId: string | null = null;
let unsubscribe: (() => void) | null = null;

function startCategoriesListener(orgId: string) {
  if (startedOrgId === orgId) return;
  unsubscribe?.();
  startedOrgId = orgId;
  useCategoriesStore.setState({ custom: [], loaded: false });
  unsubscribe = onSnapshot(
    query(collection(db, 'categories'), where('orgId', '==', orgId)),
    (snap) => {
      const custom = snap.docs.map((d) => d.data().name as string);
      useCategoriesStore.setState({ custom, loaded: true });
    },
    () => {
      startedOrgId = null;
    }
  );
}

export function useCategories() {
  const { appUser } = useAuth();
  useEffect(() => {
    if (appUser?.orgId) startCategoriesListener(appUser.orgId);
  }, [appUser?.orgId]);
  const { custom, loaded } = useCategoriesStore();
  const all = [...DEFAULT_CATEGORIES];
  for (const name of custom) {
    if (!all.includes(name)) all.push(name);
  }
  return { categories: all, loaded };
}

export async function addCategory(name: string, orgId: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'categories'), { name: trimmed, orgId });
}
