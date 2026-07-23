import { useEffect } from 'react';
import { create } from 'zustand';
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/useAuth';

// Categories shipped with the app. Anything added later via "Add category"
// lives in Firestore and is merged in alongside these.
export const DEFAULT_CATEGORIES = ['Camera', 'Lighting', 'Audio', 'Lens', 'Tripod', 'Computer', 'Memory Card', 'Other'];

interface CategoriesState {
  custom: string[];
  excludedCategories: string[];
  loaded: boolean;
}

export const useCategoriesStore = create<CategoriesState>(() => ({
  custom: [],
  excludedCategories: [],
  loaded: false,
}));

let startedOrgId: string | null = null;
let unsubCategories: (() => void) | null = null;
let unsubOrg: (() => void) | null = null;

function startCategoriesListener(orgId: string) {
  if (startedOrgId === orgId) return;
  unsubCategories?.();
  unsubOrg?.();
  startedOrgId = orgId;
  useCategoriesStore.setState({ custom: [], excludedCategories: [], loaded: false });

  unsubCategories = onSnapshot(
    query(collection(db, 'categories'), where('orgId', '==', orgId)),
    (snap) => {
      const custom = snap.docs.map((d) => d.data().name as string);
      useCategoriesStore.setState({ custom, loaded: true });
    },
    () => { startedOrgId = null; }
  );

  unsubOrg = onSnapshot(
    doc(db, 'organizations', orgId),
    (snap) => {
      const excluded = (snap.data()?.excludedCategories as string[] | undefined) ?? [];
      useCategoriesStore.setState({ excludedCategories: excluded });
    },
    () => {}
  );
}

export function useCategories() {
  const { appUser } = useAuth();
  useEffect(() => {
    if (appUser?.orgId) startCategoriesListener(appUser.orgId);
  }, [appUser?.orgId]);
  const { custom, excludedCategories, loaded } = useCategoriesStore();
  const all = [...DEFAULT_CATEGORIES];
  for (const name of custom) {
    if (!all.includes(name)) all.push(name);
  }
  return { categories: all, excludedCategories, loaded };
}

export async function addCategory(name: string, orgId: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'categories'), { name: trimmed, orgId });
}

export async function setExcludedCategories(orgId: string, excluded: string[]) {
  await updateDoc(doc(db, 'organizations', orgId), { excludedCategories: excluded });
}
