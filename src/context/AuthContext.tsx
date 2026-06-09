import React, { useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AppUser } from '../types';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function ensureUserDoc(user: User, displayName?: string) {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const newUser = {
        uid: user.uid,
        email: user.email ?? '',
        displayName: displayName ?? user.displayName ?? 'User',
        role: 'user' as const,
        emailVerified: false,
        createdAt: serverTimestamp(),
        // Only include photoURL if it actually exists — Firestore rejects undefined
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
      };
      await setDoc(ref, newUser);
      return newUser as unknown as AppUser;
    }
    const existing = snap.data() as AppUser;
    // If the auth listener created the doc with the 'User' fallback before the
    // chosen displayName was available (registration race), backfill the real name.
    if (displayName && displayName !== existing.displayName) {
      await updateDoc(ref, { displayName });
      return { ...existing, displayName };
    }
    return existing;
  }

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      setCurrentUser(user);
      if (user) {
        await ensureUserDoc(user);
        unsubDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) setAppUser(snap.data() as AppUser);
          setLoading(false);
        });
      } else {
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => { unsubAuth(); if (unsubDoc) unsubDoc(); };
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function register(email: string, password: string, displayName: string) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    await sendEmailVerification(user);
    // ensureUserDoc backfills the name if the auth listener already created the doc
    // with the 'User' fallback; apply the result so in-memory state is correct too.
    const data = await ensureUserDoc(user, displayName);
    setAppUser(data);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ currentUser, appUser, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
