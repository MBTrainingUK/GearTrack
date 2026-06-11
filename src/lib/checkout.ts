import { startOfDay } from 'date-fns';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Checkout, Item } from '../types';

// A checkout is overdue when it's still active and its due date is before today.
// `overdue` is never persisted as a status — it is always derived from the due date,
// compared at day-level (not millisecond) so same-day returns aren't counted late.
export function isOverdue(c: Checkout): boolean {
  if (c.status !== 'active') return false;
  try {
    return startOfDay(new Date()) > startOfDay(c.dueDate.toDate());
  } catch {
    return false;
  }
}

export interface NewCheckout {
  userId: string;
  userName: string;
  userEmail: string;
  itemIds: string[];
  dueDate: Timestamp;
  reservationId?: string | null;
  kitId?: string | null;
  notes?: string;
}

// Creates the checkout, flips item statuses, and marks a linked reservation as
// checked out — all in one transaction, so two people can't grab the same item
// at once and a mid-write failure can't leave items half-updated.
// Throws with a user-readable message if any item is no longer available.
export async function createCheckout(input: NewCheckout): Promise<string> {
  const checkoutRef = doc(collection(db, 'checkouts'));
  await runTransaction(db, async (tx) => {
    for (const itemId of input.itemIds) {
      const snap = await tx.get(doc(db, 'items', itemId));
      const item = snap.data() as Item | undefined;
      if (!snap.exists() || item?.status !== 'available') {
        throw new Error(`${item?.name ?? 'An item'} is no longer available`);
      }
    }
    tx.set(checkoutRef, {
      reservationId: input.reservationId ?? null,
      kitId: input.kitId ?? null,
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      itemIds: input.itemIds,
      checkedOutAt: serverTimestamp(),
      dueDate: input.dueDate,
      status: 'active',
      notes: input.notes ?? '',
    });
    for (const itemId of input.itemIds) {
      tx.update(doc(db, 'items', itemId), {
        status: 'checked_out',
        updatedAt: serverTimestamp(),
      });
    }
    if (input.reservationId) {
      tx.update(doc(db, 'reservations', input.reservationId), {
        status: 'checked_out',
        updatedAt: serverTimestamp(),
      });
    }
  });
  return checkoutRef.id;
}
