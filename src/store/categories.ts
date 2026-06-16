import { useEffect } from 'react';
import { create } from 'zustand';
import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

let started = false;

function startCategoriesListener() {
  if (started) return;
  started = true;
  onSnapshot(
    collection(db, 'categories'),
    (snap) => {
      const custom = snap.docs.map((d) => d.data().name as string);
      useCategoriesStore.setState({ custom, loaded: true });
    },
    () => {
      started = false;
    }
  );
}

export function useCategories() {
  useEffect(() => { startCategoriesListener(); }, []);
  const { custom, loaded } = useCategoriesStore();
  const all = [...DEFAULT_CATEGORIES];
  for (const name of custom) {
    if (!all.includes(name)) all.push(name);
  }
  return { categories: all, loaded };
}

export async function addCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'categories'), { name: trimmed });
}
