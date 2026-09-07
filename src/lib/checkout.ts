import { startOfDay } from 'date-fns';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Checkout, CheckoutDeclarations, CheckoutType, Item } from '../types';

// Bump when the wording below changes, so an old acceptance is never mistaken
// for agreement to new terms.
export const PERSONAL_DECLARATIONS_VERSION = '2026-09';

export const AVAILABILITY_DECLARATION = {
  intro: 'Before proceeding with your booking, please confirm the following:',
  points: [
    'I have consulted the Team Calendar in Monday and/or spoken to my Project Coordinator to check that the equipment I intend to book is not needed for business use during the dates I have selected.',
    'Once booked, it remains my responsibility to double-check that the equipment is not needed before removing any kit from the premises.',
    'If any conflict arises as a result of a change to the availability of your requested equipment, I MUST bring this to the attention of the Project Coordinator and may be required to cancel my booking.',
    'I confirm that, in the event of loss or damage, the business will still be able to operate without significant issue or delay.',
  ],
  accept: 'Tick the box to accept these terms',
};

export const LIABILITY_DECLARATION = {
  text: 'By submitting this request, I confirm that I will take appropriate measures to ensure safe usage, transportation and storage of all equipment for the duration of my booking. I accept that I may be liable for a £1000 excess in the event of damage or loss of equipment.',
  accept: 'Tick to accept',
};

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
  declarations?: CheckoutDeclarations;
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
  // Guarded here as well as in the form and the security rules: no approval
  // request should ever exist without a recorded acceptance behind it.
  if (
    isPersonalCheckout &&
    !(input.declarations?.availabilityChecked && input.declarations?.liabilityAccepted)
  ) {
    throw new Error('Both declarations must be accepted before requesting a personal checkout');
  }
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
      ...(isPersonalCheckout
        ? {
            personalReason: input.personalReason ?? '',
            declarations: input.declarations,
            declarationsAcceptedAt: serverTimestamp(),
          }
        : {}),
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
