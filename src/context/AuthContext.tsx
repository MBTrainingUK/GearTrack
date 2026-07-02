import React, { useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../lib/firebase';
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const data = await ensureUserDoc(user);
          // If the token is missing orgId/role claims, sync them from the
          // Firestore doc now so all rules work without requiring a manual fix.
          const token = await user.getIdTokenResult();
          if (data.orgId && (!token.claims.orgId || !token.claims.role)) {
            try {
              await httpsCallable(functions, 'syncClaims')({});
              await user.getIdToken(true);
            } catch {
              // Non-fatal — the app will still load, some queries may fail
            }
          }
          setAppUser(data);
        } catch (e) {
          console.error('Failed to load user doc:', e);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ currentUser, appUser, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
