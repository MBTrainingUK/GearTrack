// Rules tests for personal reservations.
//
// Run with:  npm run test:rules
//
// These exist because the reservation rules are the only thing standing between
// a borrower and self-authorising their own £1000-excess personal loan — the
// Cloud Functions that approve one bypass rules entirely, so a hole here is not
// caught anywhere else. Every case that starts "regression:" is existing work
// reservation behaviour that must not change.

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';

// Every assertFails case logs its own denial otherwise, burying the results.
setLogLevel('silent');

const ORG = 'org1';
const failures = [];
let passed = 0;

const testEnv = await initializeTestEnvironment({
  projectId: 'geartrack-rules-test',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// Roles are read from the users collection by isAdmin()/isManager(), and orgId
// from the token, so every actor needs both.
function ctx(uid, role) {
  return testEnv.authenticatedContext(uid, { orgId: ORG, role }).firestore();
}

async function seedUsers() {
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [uid, role] of [
      ['borrower', 'user'],
      ['other', 'user'],
      ['mgr', 'manager'],
      ['adm', 'admin'],
    ]) {
      await setDoc(doc(db, 'users', uid), { uid, orgId: ORG, role, email: `${uid}@x.test` });
    }
  });
}

async function seedReservation(id, data) {
  await testEnv.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'reservations', id), {
      orgId: ORG,
      userId: 'borrower',
      userName: 'Borrower',
      userEmail: 'borrower@x.test',
      itemIds: ['item1'],
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      autoCheckout: true,
      notes: '',
      ...data,
    });
  });
}

const goodDeclarations = {
  availabilityChecked: true,
  liabilityAccepted: true,
  version: '2026-09',
};

function personalDoc(overrides = {}) {
  return {
    orgId: ORG,
    userId: 'borrower',
    userName: 'Borrower',
    userEmail: 'borrower@x.test',
    itemIds: ['item1'],
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-05'),
    status: 'pending',
    type: 'personal',
    personalReason: 'Weekend away',
    declarations: goodDeclarations,
    autoCheckout: true,
    notes: '',
    ...overrides,
  };
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

await seedUsers();

console.log('\ncreate:');

await test('personal booking with both declarations is allowed', async () => {
  await assertSucceeds(
    setDoc(doc(ctx('borrower', 'user'), 'reservations', 'c1'), personalDoc())
  );
});

await test('personal booking without declarations is rejected', async () => {
  const d = personalDoc();
  delete d.declarations;
  await assertFails(setDoc(doc(ctx('borrower', 'user'), 'reservations', 'c2'), d));
});

await test('personal booking with a declaration left unticked is rejected', async () => {
  await assertFails(
    setDoc(
      doc(ctx('borrower', 'user'), 'reservations', 'c3'),
      personalDoc({ declarations: { ...goodDeclarations, liabilityAccepted: false } })
    )
  );
});

await test('personal booking cannot be created pre-approved', async () => {
  await assertFails(
    setDoc(doc(ctx('borrower', 'user'), 'reservations', 'c4'), personalDoc({ status: 'approved' }))
  );
});

await test('personal booking cannot be raised in someone else\'s name', async () => {
  await assertFails(
    setDoc(
      doc(ctx('mgr', 'manager'), 'reservations', 'c5'),
      personalDoc({ userId: 'other', userName: 'Other' })
    )
  );
});

await test('personal booking cannot be created carrying an approval stamp', async () => {
  await assertFails(
    setDoc(
      doc(ctx('borrower', 'user'), 'reservations', 'c6'),
      personalDoc({ approvedBy: 'borrower', approvedAt: new Date() })
    )
  );
});

await test('regression: an ordinary work reservation still creates', async () => {
  await assertSucceeds(
    setDoc(doc(ctx('borrower', 'user'), 'reservations', 'c7'), {
      orgId: ORG,
      userId: 'borrower',
      userName: 'Borrower',
      userEmail: 'borrower@x.test',
      itemIds: ['item1'],
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      status: 'pending',
      type: 'work',
      autoCheckout: true,
      notes: '',
    })
  );
});

console.log('\nself-authorisation:');

await test('borrower cannot approve their own pending personal booking', async () => {
  await seedReservation('u1', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'u1'), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('manager cannot approve a personal booking', async () => {
  await seedReservation('u2', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('mgr', 'manager'), 'reservations', 'u2'), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('admin cannot approve a personal booking from the client either', async () => {
  await seedReservation('u3', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('adm', 'admin'), 'reservations', 'u3'), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('borrower cannot stamp their own approval fields', async () => {
  await seedReservation('u4', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'u4'), {
      approvedBy: 'adm',
      approvedByName: 'Admin',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('borrower cannot downgrade a personal booking to work', async () => {
  await seedReservation('u5', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'u5'), {
      type: 'work',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('borrower cannot rewrite the declarations after submitting', async () => {
  await seedReservation('u6', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'u6'), {
      declarations: { ...goodDeclarations, version: 'tampered' },
      updatedAt: serverTimestamp(),
    })
  );
});

console.log('\npending request frozen:');

await test('gear cannot be swapped while a personal booking awaits a decision', async () => {
  await seedReservation('f1', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'f1'), {
      itemIds: ['item1', 'item2'],
      updatedAt: serverTimestamp(),
    })
  );
});

await test('dates cannot be moved while a personal booking awaits a decision', async () => {
  await seedReservation('f2', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'f2'), {
      endDate: new Date('2026-11-30'),
      updatedAt: serverTimestamp(),
    })
  );
});

await test('notes stay editable while awaiting a decision', async () => {
  await seedReservation('f3', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertSucceeds(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'f3'), {
      notes: 'Back Sunday night',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('borrower can withdraw their own pending personal booking', async () => {
  await seedReservation('f4', { status: 'pending', type: 'personal', declarations: goodDeclarations });
  await assertSucceeds(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'f4'), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('manager can cancel an approved personal booking', async () => {
  await seedReservation('f5', { status: 'approved', type: 'personal', declarations: goodDeclarations });
  await assertSucceeds(
    updateDoc(doc(ctx('mgr', 'manager'), 'reservations', 'f5'), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    })
  );
});

// Matches work reservations: once approved, only a manager may cancel. The
// owner's own update branch is limited to pending and to closing out returns.
await test('borrower cannot cancel their own approved booking, as before', async () => {
  await seedReservation('f5b', { status: 'approved', type: 'personal', declarations: goodDeclarations });
  await assertFails(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'f5b'), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('borrower can close out their own returned personal gear', async () => {
  await seedReservation('f6', { status: 'checked_out', type: 'personal', declarations: goodDeclarations });
  await assertSucceeds(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'f6'), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    })
  );
});

console.log('\nregressions — work reservations must be untouched:');

await test('regression: manager still approves a work reservation', async () => {
  await seedReservation('w1', { status: 'pending', type: 'work' });
  await assertSucceeds(
    updateDoc(doc(ctx('mgr', 'manager'), 'reservations', 'w1'), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('regression: manager still approves a legacy reservation with no type', async () => {
  await seedReservation('w2', { status: 'pending' });
  await assertSucceeds(
    updateDoc(doc(ctx('mgr', 'manager'), 'reservations', 'w2'), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('regression: owner still edits a pending work reservation', async () => {
  await seedReservation('w3', { status: 'pending', type: 'work' });
  await assertSucceeds(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'w3'), {
      itemIds: ['item1', 'item2'],
      updatedAt: serverTimestamp(),
    })
  );
});

await test('regression: manager still edits a legacy reservation\'s items', async () => {
  await seedReservation('w4', { status: 'approved' });
  await assertSucceeds(
    updateDoc(doc(ctx('mgr', 'manager'), 'reservations', 'w4'), {
      itemIds: ['item9'],
      updatedAt: serverTimestamp(),
    })
  );
});

await test('regression: manager still cancels a work reservation', async () => {
  await seedReservation('w5', { status: 'approved', type: 'work' });
  await assertSucceeds(
    updateDoc(doc(ctx('mgr', 'manager'), 'reservations', 'w5'), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('regression: owner still closes out a checked-out work reservation', async () => {
  await seedReservation('w6', { status: 'checked_out', type: 'work' });
  await assertSucceeds(
    updateDoc(doc(ctx('borrower', 'user'), 'reservations', 'w6'), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    })
  );
});

await test('regression: another org\'s user still cannot read a reservation', async () => {
  await seedReservation('w7', { status: 'approved', type: 'work' });
  const outsider = testEnv.authenticatedContext('outsider', { orgId: 'org2', role: 'admin' }).firestore();
  await assertFails(getDoc(doc(outsider, 'reservations', 'w7')));
});

await testEnv.cleanup();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
