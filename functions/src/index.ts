import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

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
 * One-time bootstrap: creates a default organization for the data that
 * existed before multi-tenancy, moves every existing user into it
 * (keeping their current role), backfills orgId onto every existing
 * document, and promotes the caller specifically to platform admin.
 * Self-disables once any organization exists. Callable by any
 * pre-migration admin, since there's no platform admin yet to gate this on.
 */
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
