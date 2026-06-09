import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { AuditLog } from '../types';

export async function writeAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLog'), { ...entry, timestamp: serverTimestamp() });
  } catch {
    // Audit log failures must never block user-facing actions
  }
}
