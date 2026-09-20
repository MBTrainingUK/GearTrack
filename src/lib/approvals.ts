import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { writeAuditLog } from './auditLog';
import type { AppUser, Reservation } from '../types';

// The decisions behind the approvals queue, in one place so a second screen
// can offer them without re-implementing who is allowed to do what.
//
// The split that matters: a **work** reservation is approved by writing the
// document, which the rules permit for managers and admins. A **personal**
// booking or checkout never is — the rules refuse that write, because it is
// exactly the write that would let a borrower authorise their own £1000-excess
// loan. Those go through admin-only callables that run with the Admin SDK.

export interface Actor {
  uid: string;
  appUser: AppUser;
}

// A reservation written before personal bookings existed has no `type`, so a
// missing value means work rather than unknown — matching isPersonal() in
// lib/checkout.ts.
export function isPersonalReservation(r: Pick<Reservation, 'type'>): boolean {
  return r.type === 'personal';
}

export async function approveWorkReservation(id: string, targetName: string, actor: Actor) {
  await updateDoc(doc(db, 'reservations', id), {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });
  await writeAuditLog({
    orgId: actor.appUser.orgId,
    action: 'approve_reservation',
    performedBy: actor.uid,
    performedByName: actor.appUser.displayName,
    targetType: 'reservation',
    targetId: id,
    targetName,
  });
}

export async function cancelReservation(id: string, targetName: string, actor: Actor) {
  await updateDoc(doc(db, 'reservations', id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
  await writeAuditLog({
    orgId: actor.appUser.orgId,
    action: 'cancel_reservation',
    performedBy: actor.uid,
    performedByName: actor.appUser.displayName,
    targetType: 'reservation',
    targetId: id,
    targetName,
  });
}

// Admin-only, server-side. The callable writes its own audit entry.
export async function decidePersonalReservation(id: string, approve: boolean, reason?: string) {
  await httpsCallable<{ reservationId: string; reason?: string }, { reservationId: string }>(
    functions,
    approve ? 'approveReservation' : 'declineReservation'
  )({ reservationId: id, ...(reason ? { reason } : {}) });
}

// Admin-only, server-side. The callable writes its own audit entry.
export async function decidePersonalCheckout(id: string, approve: boolean, reason?: string) {
  await httpsCallable<{ checkoutId: string; reason?: string }, { checkoutId: string }>(
    functions,
    approve ? 'approveCheckout' : 'declineCheckout'
  )({ checkoutId: id, ...(reason ? { reason } : {}) });
}

// The requester withdrawing their own pending request.
export async function withdrawCheckoutRequest(id: string) {
  await httpsCallable<{ checkoutId: string }, { checkoutId: string }>(
    functions,
    'cancelCheckoutRequest'
  )({ checkoutId: id });
}
