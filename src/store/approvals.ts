import { useEffect } from 'react';
import { create } from 'zustand';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/useAuth';
import { isPersonalReservation } from '../lib/approvals';
import type { Checkout, Reservation, UserRole } from '../types';

// Everything waiting on a decision, so the sidebar can show a count without
// each screen going to look for itself. Only started for managers and admins —
// an ordinary user has nothing to approve and the rules would refuse the read.

interface ApprovalsState {
  reservations: Reservation[];
  checkouts: Checkout[];
  loaded: boolean;
}

export const useApprovalsStore = create<ApprovalsState>(() => ({
  reservations: [],
  checkouts: [],
  loaded: false,
}));

let startedOrgId: string | null = null;
let unsubs: (() => void)[] = [];

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  startedOrgId = null;
}

function start(orgId: string) {
  if (startedOrgId === orgId) return;
  stop();
  startedOrgId = orgId;
  useApprovalsStore.setState({ reservations: [], checkouts: [], loaded: false });

  unsubs.push(
    onSnapshot(
      query(collection(db, 'reservations'), where('orgId', '==', orgId), where('status', '==', 'pending')),
      (snap) => {
        useApprovalsStore.setState({
          reservations: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)),
          loaded: true,
        });
      },
      // Dies on sign-out (permission-denied); allow a restart next mount.
      () => { startedOrgId = null; }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'checkouts'), where('orgId', '==', orgId), where('status', '==', 'pending_approval')),
      (snap) => {
        useApprovalsStore.setState({
          checkouts: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)),
        });
      },
      () => { startedOrgId = null; }
    )
  );
}

export interface PendingApprovals {
  // Work reservations a manager or admin can approve by writing the doc.
  workReservations: Reservation[];
  // Personal bookings and checkouts, which only an admin can decide.
  personalReservations: Reservation[];
  personalCheckouts: Checkout[];
  // What *this* user is able to act on — what the sidebar badge counts.
  count: number;
  canApprove: boolean;
}

export function usePendingApprovals(): PendingApprovals {
  const { appUser } = useAuth();
  const role: UserRole | undefined = appUser?.role;
  const canApprove = role === 'admin' || role === 'manager';
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (canApprove && appUser?.orgId) start(appUser.orgId);
    else stop();
  }, [canApprove, appUser?.orgId]);

  const { reservations, checkouts } = useApprovalsStore();

  const workReservations = reservations.filter((r) => !isPersonalReservation(r));
  const personalReservations = reservations.filter(isPersonalReservation);
  const personalCheckouts = isAdmin ? checkouts : [];

  // A manager sees only what a manager can actually decide, so the badge never
  // promises work they'll be refused when they open it.
  const count = canApprove
    ? workReservations.length + (isAdmin ? personalReservations.length + personalCheckouts.length : 0)
    : 0;

  return {
    workReservations: canApprove ? workReservations : [],
    personalReservations: isAdmin ? personalReservations : [],
    personalCheckouts,
    count,
    canApprove,
  };
}
