import { startOfDay } from 'date-fns';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Checkout, CheckoutType, Item } from '../types';

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

// `type` is absent on every checkout written before personal checkouts existed,
// so a missing value means work rather than unknown.
export function isPersonal(c: Pick<Checkout, 'type'>): boolean {
  return c.type === 'personal';
}

export function checkoutType(c: Pick<Checkout, 'type'>): CheckoutType {
  return c.type === 'personal' ? 'personal' : 'work';
}

export interface NewCheckout {
  orgId: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemIds: string[];
  dueDate: Timestamp;
  reservationId?: string | null;
  kitId?: string | null;
  notes?: string;
  type?: CheckoutType;
  personalReason?: string;
}

// Creates the checkout, flips item statuses, and marks a linked reservation as
// checked out — all in one transaction, so two people can't grab the same item
// at once and a mid-write failure can't leave items half-updated.
// Throws with a user-readable message if any item is no longer available.
//
// Personal checkouts are written as 'pending_approval' and still take the items
// out of circulation, so nobody else can book gear that is awaiting a decision.
// Only approveCheckout (admin-only, server-side) can make one active.
export async function createCheckout(input: NewCheckout): Promise<string> {
  const type = input.type ?? 'work';
  const isPersonalCheckout = type === 'personal';
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
      orgId: input.orgId,
      reservationId: input.reservationId ?? null,
      kitId: input.kitId ?? null,
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      itemIds: input.itemIds,
      checkedOutAt: serverTimestamp(),
      dueDate: input.dueDate,
      status: isPersonalCheckout ? 'pending_approval' : 'active',
      type,
      ...(isPersonalCheckout ? { personalReason: input.personalReason ?? '' } : {}),
      notes: input.notes ?? '',
    });
    for (const itemId of input.itemIds) {
      tx.update(doc(db, 'items', itemId), {
        status: 'checked_out',
        updatedAt: serverTimestamp(),
      });
    }
    if (input.reservationId && !isPersonalCheckout) {
      tx.update(doc(db, 'reservations', input.reservationId), {
        status: 'checked_out',
        updatedAt: serverTimestamp(),
      });
    }
  });
  return checkoutRef.id;
}
