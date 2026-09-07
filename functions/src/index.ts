import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  RESEND_API_KEY,
  sendEmail,
  getOrgStaffEmails,
  getItemNames,
  reservationPendingEmail,
  reservationApprovedEmail,
  dueTomorrowEmail,
  overdueEmail,
  personalCheckoutPendingEmail,
  personalCheckoutApprovedEmail,
  personalCheckoutDeclinedEmail,
  personalCheckoutReminderEmail,
} from './email';

initializeApp();

type Role = 'admin' | 'manager' | 'user';
const VALID_ROLES: Role[] = ['admin', 'manager', 'user'];

/** Wraps auth.createUser() so common failures reach the client as a clear message instead of being stripped to "internal". */
async function createAuthUser(auth: ReturnType<typeof getAuth>, email: string, displayName: string) {
  try {
    return await auth.createUser({ email, displayName });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', `An account with the email ${email} already exists.`);
    }
    if (code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', `"${email}" isn't a valid email address.`);
    }
    throw err;
  }
}

/**
 * Platform-admin only. Creates a brand new organization plus its first
 * org admin user. orgId/role are set as custom claims (security-rule
 * source of truth) and mirrored onto the users/{uid} Firestore doc (so the
 * app's existing AuthContext read path needs no change).
 */
export const createOrganization = onCall(async (request) => {
  if (request.auth?.token?.platformAdmin !== true) {
    throw new HttpsError('permission-denied', 'Only a platform admin can create an organization.');
  }

  const { orgName, adminEmail, adminDisplayName } = (request.data ?? {}) as {
    orgName?: string;
    adminEmail?: string;
    adminDisplayName?: string;
  };
  if (!orgName?.trim() || !adminEmail?.trim() || !adminDisplayName?.trim()) {
    throw new HttpsError('invalid-argument', 'orgName, adminEmail, and adminDisplayName are required.');
  }

  const db = getFirestore();
  const auth = getAuth();

  // Create the Auth user first — if this fails (bad/duplicate email), there's
  // no org doc left orphaned behind it.
  const userRecord = await createAuthUser(auth, adminEmail.trim(), adminDisplayName.trim());

  const orgRef = db.collection('organizations').doc();
  await orgRef.set({
    name: orgName.trim(),
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  });

  await auth.setCustomUserClaims(userRecord.uid, { orgId: orgRef.id, role: 'admin' satisfies Role });

  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: adminEmail.trim(),
    displayName: adminDisplayName.trim(),
    role: 'admin',
    orgId: orgRef.id,
    createdAt: FieldValue.serverTimestamp(),
  });

  const resetLink = await auth.generatePasswordResetLink(adminEmail.trim());

  return { orgId: orgRef.id, uid: userRecord.uid, resetLink };
});

/**
 * Adds one user to an existing organization. Callable by that org's own
 * admin (scoped to their orgId) or by a platform admin (any orgId).
 */
export const createOrgUser = onCall(async (request) => {
  const callerIsPlatformAdmin = request.auth?.token?.platformAdmin === true;
  const callerOrgId = request.auth?.token?.orgId as string | undefined;
  const callerRole = request.auth?.token?.role as Role | undefined;

  if (!callerIsPlatformAdmin && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only an org admin or platform admin can add users.');
  }

  const { orgId, email, displayName, role } = (request.data ?? {}) as {
    orgId?: string;
    email?: string;
    displayName?: string;
    role?: Role;
  };
  if (!orgId?.trim() || !email?.trim() || !displayName?.trim() || !role) {
    throw new HttpsError('invalid-argument', 'orgId, email, displayName, and role are required.');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role.');
  }
  if (!callerIsPlatformAdmin && orgId !== callerOrgId) {
    throw new HttpsError('permission-denied', "Can't create a user outside your own organization.");
  }

  const db = getFirestore();
  const auth = getAuth();

  const userRecord = await createAuthUser(auth, email.trim(), displayName.trim());

  await auth.setCustomUserClaims(userRecord.uid, { orgId, role });

  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: email.trim(),
    displayName: displayName.trim(),
    role,
    orgId,
    createdAt: FieldValue.serverTimestamp(),
  });

  const resetLink = await auth.generatePasswordResetLink(email.trim());

  return { uid: userRecord.uid, resetLink };
});

/**
 * Shared authorisation for the two user-management callables below. Returns the
 * target's Firestore data once the caller is proven allowed to act on them.
 *
 * Org admins are scoped to their own org and may never act on a platform admin;
 * platform admins may act on anyone. Callers cannot act on themselves — losing
 * your own admin rights or account locks the org out with no way back.
 */
async function authoriseUserAction(
  request: { auth?: { uid?: string; token?: Record<string, unknown> } },
  uid: string | undefined,
  verb: string
) {
  const callerUid = request.auth?.uid;
  const callerIsPlatformAdmin = request.auth?.token?.platformAdmin === true;
  const callerOrgId = request.auth?.token?.orgId as string | undefined;
  const callerRole = request.auth?.token?.role as Role | undefined;

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  if (!callerIsPlatformAdmin && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', `Only an org admin or platform admin can ${verb} users.`);
  }
  if (!uid?.trim()) {
    throw new HttpsError('invalid-argument', 'uid is required.');
  }
  if (uid === callerUid) {
    throw new HttpsError('failed-precondition', `You can't ${verb} your own account.`);
  }

  const snap = await getFirestore().collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No such user.');
  }
  const target = snap.data()!;

  if (!callerIsPlatformAdmin) {
    if (target.orgId !== callerOrgId) {
      throw new HttpsError('permission-denied', "That user isn't in your organisation.");
    }
    if (target.isPlatformAdmin === true) {
      throw new HttpsError('permission-denied', 'Only a platform admin can manage a platform admin.');
    }
  }

  return target;
}

/**
 * Changes a user's role everywhere it actually matters: the Firestore doc, the
 * custom claims that security rules and the other callables read, and the
 * user's live session.
 *
 * Previously the client wrote the Firestore field directly, which left claims
 * stale — a demoted admin kept token-level admin rights (and could still call
 * createOrgUser) until their token happened to refresh, up to an hour later or
 * never if they simply left the tab open.
 */
export const setOrgUserRole = onCall(async (request) => {
  const { uid, role } = (request.data ?? {}) as { uid?: string; role?: Role };
  if (!role || !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'A valid role is required.');
  }

  const target = await authoriseUserAction(request, uid, 'change the role of');
  const auth = getAuth();

  // Claims are set wholesale, so anything not restated here is dropped —
  // read platformAdmin back off the existing claims rather than losing it.
  const existing = (await auth.getUser(uid!)).customClaims ?? {};
  const claims: Record<string, unknown> = { orgId: target.orgId, role };
  if (existing.platformAdmin === true) claims.platformAdmin = true;

  await auth.setCustomUserClaims(uid!, claims);
  await getFirestore().collection('users').doc(uid!).update({ role });
  // Invalidate outstanding tokens so the new role takes effect on the next
  // request instead of whenever the old token happens to expire.
  await auth.revokeRefreshTokens(uid!);

  return { uid, role };
});

/**
 * Removes a user for real: Firestore doc, live sessions, and the Auth account.
 *
 * Deleting only the Firestore doc (what the client used to do) left the Auth
 * account intact and the user's token still carrying orgId — so a "removed"
 * person could keep signing in and reading, and in this deployment editing,
 * the whole organisation's inventory until their token expired.
 */
export const removeOrgUser = onCall(async (request) => {
  const { uid } = (request.data ?? {}) as { uid?: string };
  await authoriseUserAction(request, uid, 'remove');

  const auth = getAuth();
  await getFirestore().collection('users').doc(uid!).delete();

  // Revoke before deleting: if deleteUser fails for any reason, the session is
  // already dead rather than left alive by a half-finished removal.
  try {
    await auth.revokeRefreshTokens(uid!);
    await auth.deleteUser(uid!);
  } catch (err) {
    // An orphaned Firestore doc with no Auth account is a valid state to hit
    // here — the goal (no access, no record) is still met.
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  }

  return { uid };
});

/**
 * One-time bootstrap: creates a default organization for the data that
 * existed before multi-tenancy, moves every existing user into it
 * (keeping their current role), backfills orgId onto every existing
 * document, and promotes the caller specifically to platform admin.
 * Self-disables once any organization exists. Callable by any
 * pre-migration admin, since there's no platform admin yet to gate this on.
 */
/**
 * Re-applies orgId/role custom claims from the user's Firestore doc.
 * Useful when claims are missing or stale (e.g. on a new environment).
 * Callable by any authenticated user for their own account only.
 */
export const syncClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }

  const db = getFirestore();
  const auth = getAuth();

  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'No user record found — contact your administrator.');
  }

  const data = userDoc.data()!;
  const orgId = data.orgId as string | undefined;
  const role = (data.role as Role | undefined) ?? 'user';

  if (!orgId) {
    throw new HttpsError('failed-precondition', 'No organisation assigned — contact your administrator.');
  }

  // platformAdmin is deliberately NOT derived from the Firestore doc. Users can
  // edit their own user doc, so trusting that field here would let anyone mint
  // themselves cross-org access. An existing claim is carried over untouched;
  // granting it to someone new is a deliberate out-of-band operation (Firebase
  // console or a one-off Admin SDK script), never a self-service call.
  const claims: Record<string, unknown> = { orgId, role };
  if (request.auth.token.platformAdmin === true) claims.platformAdmin = true;

  await auth.setCustomUserClaims(request.auth.uid, claims);

  return { orgId, role };
});

export const backfillDefaultOrg = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }

  const db = getFirestore();
  const auth = getAuth();

  const existingOrgs = await db.collection('organizations').limit(1).get();
  if (!existingOrgs.empty) {
    throw new HttpsError('failed-precondition', 'Backfill has already run — an organization already exists.');
  }

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'Backfill can only be run by an existing admin, before any organizations exist.'
    );
  }

  const { orgName } = (request.data ?? {}) as { orgName?: string };

  const orgRef = db.collection('organizations').doc();
  await orgRef.set({
    name: orgName?.trim() || 'Default Organization',
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Promote the caller to platform admin; every other existing user joins
  // the new default org too, keeping their current role.
  await auth.setCustomUserClaims(request.auth.uid, {
    orgId: orgRef.id,
    role: 'admin' satisfies Role,
    platformAdmin: true,
  });
  await db.collection('users').doc(request.auth.uid).update({
    orgId: orgRef.id,
    isPlatformAdmin: true,
  });

  const allUsers = await db.collection('users').get();
  for (const userDoc of allUsers.docs) {
    if (userDoc.id === request.auth.uid) continue;
    const role = (userDoc.data().role as Role | undefined) ?? 'user';
    await auth.setCustomUserClaims(userDoc.id, { orgId: orgRef.id, role });
    await userDoc.ref.update({ orgId: orgRef.id });
  }

  for (const col of ['items', 'kits', 'checkouts', 'reservations', 'auditLog', 'categories']) {
    const snap = await db.collection(col).get();
    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.update(doc.ref, { orgId: orgRef.id });
      count++;
      if (count % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 450 !== 0) {
      await batch.commit();
    }
  }

  return { orgId: orgRef.id };
});

/**
 * Runs every 5 minutes. Finds approved reservations with autoCheckout=true
 * whose startDate has passed, then creates a checkout and flips item statuses
 * in a single transaction — matching the atomicity guarantee of createCheckout.
 */
export const autoCheckoutReservations = onSchedule('every 5 minutes', async () => {
  const db = getFirestore();
  const now = new Date();

  const snap = await db
    .collection('reservations')
    .where('status', '==', 'approved')
    .where('autoCheckout', '==', true)
    .where('startDate', '<=', now)
    .get();

  if (snap.empty) return;

  await Promise.all(
    snap.docs.map(async (resDoc) => {
      const res = resDoc.data();
      const itemIds: string[] = res.itemIds ?? [];
      if (itemIds.length === 0) return;

      try {
        const checkoutRef = db.collection('checkouts').doc();
        await db.runTransaction(async (tx) => {
          for (const itemId of itemIds) {
            const itemSnap = await tx.get(db.collection('items').doc(itemId));
            if (!itemSnap.exists || itemSnap.data()?.status !== 'available') {
              throw new Error(`Item ${itemId} is no longer available`);
            }
          }
          tx.set(checkoutRef, {
            orgId: res.orgId,
            reservationId: resDoc.id,
            kitId: res.kitId ?? null,
            userId: res.userId,
            userName: res.userName,
            userEmail: res.userEmail,
            itemIds,
            checkedOutAt: FieldValue.serverTimestamp(),
            dueDate: res.endDate,
            status: 'active',
            notes: res.notes ?? '',
            autoCheckedOut: true,
          });
          for (const itemId of itemIds) {
            tx.update(db.collection('items').doc(itemId), {
              status: 'checked_out',
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          tx.update(resDoc.ref, {
            status: 'checked_out',
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        await db.collection('auditLog').add({
          orgId: res.orgId,
          action: 'checkout',
          performedBy: 'system',
          performedByName: 'Auto-checkout',
          targetType: 'checkout',
          targetId: checkoutRef.id,
          targetName: res.userName,
          timestamp: FieldValue.serverTimestamp(),
          details: { reservationId: resDoc.id, trigger: 'autoCheckout' },
        });
      } catch (err) {
        console.error(`autoCheckout failed for reservation ${resDoc.id}:`, err);
      }
    })
  );
});

// ── Personal checkout approval ───────────────────────────────────────

/**
 * Shared authorisation and load for the personal-checkout decision callables.
 *
 * Admin-only by deliberate choice: managers approve reservations, but gear
 * going home for personal use is a different risk. The check reads the role
 * from the token rather than the Firestore doc because setOrgUserRole revokes
 * refresh tokens on demotion, so a former admin can't linger with rights here.
 *
 * Self-approval is permitted. With a small admin team, forbidding it would
 * stall every request whenever one admin is away; the control is the recorded
 * approver name, which makes a self-approval plainly visible in reports.
 */
async function loadPendingPersonalCheckout(
  request: { auth?: { uid?: string; token?: Record<string, unknown> } },
  checkoutId: string | undefined,
  verb: string
) {
  const callerUid = request.auth?.uid;
  const callerIsPlatformAdmin = request.auth?.token?.platformAdmin === true;
  const callerRole = request.auth?.token?.role as Role | undefined;
  const callerOrgId = request.auth?.token?.orgId as string | undefined;

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  if (!callerIsPlatformAdmin && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', `Only an admin can ${verb} a personal checkout.`);
  }
  if (!checkoutId?.trim()) {
    throw new HttpsError('invalid-argument', 'checkoutId is required.');
  }

  const ref = getFirestore().collection('checkouts').doc(checkoutId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No such checkout.');
  }
  const data = snap.data()!;

  if (!callerIsPlatformAdmin && data.orgId !== callerOrgId) {
    throw new HttpsError('permission-denied', "That checkout isn't in your organisation.");
  }
  if (data.type !== 'personal') {
    throw new HttpsError('failed-precondition', 'Only personal checkouts need approval.');
  }
  if (data.status !== 'pending_approval') {
    throw new HttpsError('failed-precondition', 'That request has already been decided.');
  }

  return { ref, data, callerUid };
}

async function displayNameOf(uid: string, fallback: string): Promise<string> {
  const snap = await getFirestore().collection('users').doc(uid).get();
  return (snap.data()?.displayName as string | undefined) ?? fallback;
}

/**
 * Releases the items a pending request was holding, but only those still marked
 * checked_out, so a decision can never resurrect an item that has since been
 * reassigned by other means.
 */
async function releaseHeldItems(
  ref: FirebaseFirestore.DocumentReference,
  itemIds: string[],
  checkoutUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
) {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const snaps =
      itemIds.length > 0
        ? await tx.getAll(...itemIds.map((id) => db.collection('items').doc(id)))
        : [];
    tx.update(ref, checkoutUpdate);
    for (const snap of snaps) {
      if (snap.exists && snap.data()?.status === 'checked_out') {
        tx.update(snap.ref, { status: 'available', updatedAt: FieldValue.serverTimestamp() });
      }
    }
  });
}

/** Admin approves a pending personal checkout. Items are already held, so only the status changes. */
export const approveCheckout = onCall(async (request) => {
  const { checkoutId } = (request.data ?? {}) as { checkoutId?: string };
  const { ref, data, callerUid } = await loadPendingPersonalCheckout(request, checkoutId, 'approve');
  const approvedByName = await displayNameOf(callerUid, 'An admin');

  await ref.update({
    status: 'active',
    approvedBy: callerUid,
    approvedByName,
    approvedAt: FieldValue.serverTimestamp(),
  });

  await getFirestore().collection('auditLog').add({
    orgId: data.orgId,
    action: 'approve_personal_checkout',
    performedBy: callerUid,
    performedByName: approvedByName,
    targetType: 'checkout',
    targetId: ref.id,
    targetName: data.userName ?? '',
    timestamp: FieldValue.serverTimestamp(),
    details: { selfApproved: String(callerUid === data.userId) },
  });

  return { checkoutId: ref.id };
});

/** Admin declines a pending personal checkout, returning the held items to the pool. */
export const declineCheckout = onCall(async (request) => {
  const { checkoutId, reason } = (request.data ?? {}) as { checkoutId?: string; reason?: string };
  const { ref, data, callerUid } = await loadPendingPersonalCheckout(request, checkoutId, 'decline');
  const declinedByName = await displayNameOf(callerUid, 'An admin');

  await releaseHeldItems(ref, (data.itemIds as string[]) ?? [], {
    status: 'declined',
    declinedBy: callerUid,
    declinedByName,
    declinedAt: FieldValue.serverTimestamp(),
    declineReason: reason?.trim() ?? '',
  });

  await getFirestore().collection('auditLog').add({
    orgId: data.orgId,
    action: 'decline_personal_checkout',
    performedBy: callerUid,
    performedByName: declinedByName,
    targetType: 'checkout',
    targetId: ref.id,
    targetName: data.userName ?? '',
    timestamp: FieldValue.serverTimestamp(),
    ...(reason?.trim() ? { details: { reason: reason.trim() } } : {}),
  });

  return { checkoutId: ref.id };
});

/**
 * Withdraws a pending request and frees the gear. Available to the requester as
 * well as admins: without it, a mistaken request would hold an item hostage
 * until an admin happened to notice it.
 */
export const cancelCheckoutRequest = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  const { checkoutId } = (request.data ?? {}) as { checkoutId?: string };
  if (!checkoutId?.trim()) {
    throw new HttpsError('invalid-argument', 'checkoutId is required.');
  }

  const db = getFirestore();
  const ref = db.collection('checkouts').doc(checkoutId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No such checkout.');
  }
  const data = snap.data()!;

  const callerIsPlatformAdmin = request.auth?.token?.platformAdmin === true;
  const callerRole = request.auth?.token?.role as Role | undefined;
  const callerOrgId = request.auth?.token?.orgId as string | undefined;
  const isOwner = data.userId === callerUid;
  const isOrgAdmin = callerRole === 'admin' && data.orgId === callerOrgId;

  if (!callerIsPlatformAdmin && !isOwner && !isOrgAdmin) {
    throw new HttpsError('permission-denied', 'You can only cancel your own request.');
  }
  if (data.status !== 'pending_approval') {
    throw new HttpsError('failed-precondition', 'Only a pending request can be cancelled.');
  }

  const performedByName = await displayNameOf(callerUid, 'A user');

  await releaseHeldItems(ref, (data.itemIds as string[]) ?? [], {
    status: 'declined',
    declinedBy: callerUid,
    declinedByName: performedByName,
    declinedAt: FieldValue.serverTimestamp(),
    declineReason: isOwner ? 'Withdrawn by requester' : 'Cancelled by an admin',
  });

  await db.collection('auditLog').add({
    orgId: data.orgId,
    action: 'cancel_personal_checkout',
    performedBy: callerUid,
    performedByName,
    targetType: 'checkout',
    targetId: ref.id,
    targetName: data.userName ?? '',
    timestamp: FieldValue.serverTimestamp(),
  });

  return { checkoutId: ref.id };
});

// ── Email notifications ──────────────────────────────────────────────

/**
 * New pending reservation → notify the org's admins and managers so
 * someone approves it. Reservations created directly as 'approved'
 * (e.g. by a manager) send nothing.
 */
export const onReservationCreated = onDocumentCreated(
  { document: 'reservations/{reservationId}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const res = event.data?.data();
    if (!res || res.status !== 'pending') return;

    const staffEmails = (await getOrgStaffEmails(res.orgId, ['admin', 'manager'])).filter(
      // Don't notify the requester about their own reservation.
      (e) => e !== res.userEmail
    );
    if (staffEmails.length === 0) return;

    const itemNames = await getItemNames(res.itemIds ?? []);
    await sendEmail({
      to: staffEmails,
      ...reservationPendingEmail({
        userName: res.userName,
        itemNames,
        startDate: (res.startDate as Timestamp).toDate(),
        endDate: (res.endDate as Timestamp).toDate(),
      }),
    });
  }
);

/** Reservation approved (pending → approved) → notify the requester. */
export const onReservationUpdated = onDocumentUpdated(
  { document: 'reservations/{reservationId}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status !== 'pending' || after.status !== 'approved') return;
    if (!after.userEmail) return;

    const itemNames = await getItemNames(after.itemIds ?? []);
    await sendEmail({
      to: [after.userEmail],
      ...reservationApprovedEmail({
        itemNames,
        startDate: (after.startDate as Timestamp).toDate(),
        endDate: (after.endDate as Timestamp).toDate(),
      }),
    });
  }
);

/** Calendar day (yyyy-mm-dd) in the UK timezone, for day-level due-date maths. */
function ukDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

/** New personal checkout request → notify the org's admins so someone decides. */
export const onCheckoutCreated = onDocumentCreated(
  { document: 'checkouts/{checkoutId}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const c = event.data?.data();
    if (!c || c.type !== 'personal' || c.status !== 'pending_approval') return;

    // Admins only — managers can't authorise these, so copying them in would
    // invite a decision they have no way to action.
    const adminEmails = await getOrgStaffEmails(c.orgId, ['admin']);
    if (adminEmails.length === 0) return;

    const itemNames = await getItemNames(c.itemIds ?? []);
    await sendEmail({
      to: adminEmails,
      ...personalCheckoutPendingEmail({
        userName: c.userName,
        itemNames,
        dueDate: (c.dueDate as Timestamp).toDate(),
        reason: c.personalReason,
        declarationsAccepted:
          c.declarations?.availabilityChecked === true && c.declarations?.liabilityAccepted === true,
      }),
    });
  }
);

/** Personal checkout approved or declined → tell the requester either way. */
export const onCheckoutUpdated = onDocumentUpdated(
  { document: 'checkouts/{checkoutId}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || !after.userEmail) return;
    if (before.status !== 'pending_approval') return;

    const itemNames = await getItemNames(after.itemIds ?? []);

    if (after.status === 'active') {
      await sendEmail({
        to: [after.userEmail],
        ...personalCheckoutApprovedEmail({
          itemNames,
          dueDate: (after.dueDate as Timestamp).toDate(),
          approvedByName: after.approvedByName ?? 'An admin',
        }),
      });
    } else if (after.status === 'declined') {
      await sendEmail({
        to: [after.userEmail],
        ...personalCheckoutDeclinedEmail({
          itemNames,
          declinedByName: after.declinedByName ?? 'An admin',
          reason: after.declineReason,
        }),
      });
    }
  }
);

/**
 * Daily at 08:00 UK time. Sends "due tomorrow" reminders to borrowers and
 * first-overdue alerts to borrowers (CC org admins). Each email is stamped
 * on the checkout doc (dueSoonEmailAt / overdueEmailAt) so it's sent at
 * most once per checkout. Overdue is derived from the due date at
 * day-level, matching src/lib/checkout.ts — it is never stored as a status.
 */
export const sendDueDateEmails = onSchedule(
  { schedule: 'every day 08:00', timeZone: 'Europe/London', secrets: [RESEND_API_KEY] },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const today = ukDayKey(now);
    const tomorrow = ukDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    const snap = await db.collection('checkouts').where('status', '==', 'active').get();

    // Org admin lists are reused across checkouts within this run.
    const adminEmailsByOrg = new Map<string, string[]>();
    async function orgAdmins(orgId: string): Promise<string[]> {
      let emails = adminEmailsByOrg.get(orgId);
      if (!emails) {
        emails = await getOrgStaffEmails(orgId, ['admin']);
        adminEmailsByOrg.set(orgId, emails);
      }
      return emails;
    }

    for (const doc of snap.docs) {
      const c = doc.data();
      if (!c.userEmail || !c.dueDate) continue;
      const dueDate = (c.dueDate as Timestamp).toDate();
      const dueKey = ukDayKey(dueDate);

      try {
        if (dueKey === tomorrow && !c.dueSoonEmailAt) {
          const itemNames = await getItemNames(c.itemIds ?? []);
          await sendEmail({
            to: [c.userEmail],
            ...dueTomorrowEmail({ itemNames, dueDate }),
          });
          await doc.ref.update({ dueSoonEmailAt: FieldValue.serverTimestamp() });
        } else if (dueKey < today && !c.overdueEmailAt) {
          const itemNames = await getItemNames(c.itemIds ?? []);
          await sendEmail({
            to: [c.userEmail],
            cc: (await orgAdmins(c.orgId)).filter((e) => e !== c.userEmail),
            ...overdueEmail({ userName: c.userName, itemNames, dueDate }),
          });
          await doc.ref.update({ overdueEmailAt: FieldValue.serverTimestamp() });
        }
      } catch (err) {
        console.error(`sendDueDateEmails failed for checkout ${doc.id}:`, err);
      }
    }

    // Second pass: personal requests still undecided after a day. These hold
    // gear out of circulation, so a forgotten request costs the whole team.
    const pending = await db
      .collection('checkouts')
      .where('status', '==', 'pending_approval')
      .get();

    const dayAgoMs = now.getTime() - 24 * 60 * 60 * 1000;
    for (const doc of pending.docs) {
      const c = doc.data();
      if (c.approvalReminderEmailAt || !c.checkedOutAt) continue;
      const requestedAt = (c.checkedOutAt as Timestamp).toDate();
      if (requestedAt.getTime() > dayAgoMs) continue;

      try {
        const admins = await orgAdmins(c.orgId);
        if (admins.length === 0) continue;
        const itemNames = await getItemNames(c.itemIds ?? []);
        await sendEmail({
          to: admins,
          ...personalCheckoutReminderEmail({
            userName: c.userName,
            itemNames,
            requestedAt,
          }),
        });
        await doc.ref.update({ approvalReminderEmailAt: FieldValue.serverTimestamp() });
      } catch (err) {
        console.error(`Pending-approval reminder failed for checkout ${doc.id}:`, err);
      }
    }
  }
);
