import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/useAuth';
import { useItems } from '../../store/items';
import { isOverdue, isPersonal } from '../../lib/checkout';
import { cancelReservation, withdrawCheckoutRequest } from '../../lib/approvals';
import ConditionModal from '../../components/ConditionModal';
import StatusBadge from '../../components/StatusBadge';
import type { Checkout, Reservation } from '../../types';
import { format } from 'date-fns';
import { PackageCheck, RotateCcw, Home, CalendarRange, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// The desktop counterpart to the mobile "My Gear" screen: everything the
// signed-in user personally has out or has coming up, with the two actions
// that belong to them — returning gear, and calling off a booking.
export default function MyGearPage() {
  const { currentUser, appUser } = useAuth();
  const { byId: items } = useItems();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmReturn, setConfirmReturn] = useState<Checkout | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Reservation | null>(null);

  useEffect(() => {
    if (!currentUser || !appUser?.orgId) return;
    const orgId = appUser.orgId;
    const uid = currentUser.uid;
    const unsubs = [
      onSnapshot(
        query(
          collection(db, 'checkouts'),
          where('orgId', '==', orgId),
          where('userId', '==', uid),
          where('status', 'in', ['active', 'pending_approval'])
        ),
        (snap) => {
          setCheckouts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)));
          setLoading(false);
        },
        (err) => { console.error('My Gear checkouts query failed:', err); setLoading(false); }
      ),
      onSnapshot(
        query(
          collection(db, 'reservations'),
          where('orgId', '==', orgId),
          where('userId', '==', uid),
          where('status', 'in', ['pending', 'approved'])
        ),
        (snap) => setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))),
        (err) => console.error('My Gear reservations query failed:', err)
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [currentUser, appUser?.orgId]);

  function names(ids: string[]) {
    return ids.map((id) => items[id]?.name ?? '…').join(', ');
  }

  async function withdraw(c: Checkout) {
    setBusyId(c.id);
    try {
      await withdrawCheckoutRequest(c.id);
      toast.success('Request withdrawn — the gear is available again');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not withdraw the request');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(r: Reservation) {
    setConfirmCancel(null);
    setBusyId(r.id);
    try {
      await cancelReservation(r.id, `${r.userName}'s reservation`, {
        uid: currentUser!.uid,
        appUser: appUser!,
      });
      toast.success('Booking cancelled');
    } catch {
      toast.error('Failed to cancel the booking');
    } finally {
      setBusyId(null);
    }
  }

  const out = checkouts.filter((c) => c.status === 'active');
  const awaiting = checkouts.filter((c) => c.status === 'pending_approval');
  const upcoming = [...reservations].sort(
    (a, b) => a.startDate.toMillis() - b.startDate.toMillis()
  );
  const nothing = out.length === 0 && awaiting.length === 0 && upcoming.length === 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">My Gear</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {out.length > 0 ? `${out.length} item${out.length !== 1 ? 's' : ''} out` : 'Nothing out right now'}
          {upcoming.length > 0 && ` · ${upcoming.length} booking${upcoming.length !== 1 ? 's' : ''} coming up`}
        </p>
      </div>

      {nothing && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface">
          <PackageCheck size={36} className="text-ink-ghost" />
          <p className="text-sm text-ink-muted">You have no gear out and nothing booked</p>
          <p className="text-xs text-ink-faint">Add items to your basket to book something.</p>
        </div>
      )}

      {out.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">Out with you</h2>
          <div className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {out.map((c) => {
              const late = isOverdue(c);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{names(c.itemIds)}</p>
                    <p className={`text-xs ${late ? 'font-medium text-red-600 dark:text-red-400' : 'text-ink-muted'}`}>
                      {late ? 'Overdue — due ' : 'Due '}
                      {c.dueDate && format(c.dueDate.toDate(), 'd MMM yyyy')}
                    </p>
                  </div>
                  {isPersonal(c) && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-800 dark:text-purple-300">
                      <Home size={10} />
                      Personal
                    </span>
                  )}
                  <button
                    onClick={() => setConfirmReturn(c)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <RotateCcw size={14} />
                    Return
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {awaiting.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">Waiting on approval</h2>
          <div className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-amber-200 dark:border-amber-500/30 bg-surface shadow-sm">
            {awaiting.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{names(c.itemIds)}</p>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    An admin has to approve this — don't take it yet
                  </p>
                </div>
                <button
                  onClick={() => withdraw(c)}
                  disabled={busyId === c.id}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-body hover:bg-surface-hover disabled:opacity-50"
                >
                  {busyId === c.id ? 'Withdrawing…' : 'Withdraw'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarRange size={15} className="text-ink-faint" />
            Booked ahead
          </h2>
          <div className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {upcoming.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{names(r.itemIds)}</p>
                  <p className="text-xs text-ink-muted">
                    {format(r.startDate.toDate(), 'd MMM yyyy')} → {format(r.endDate.toDate(), 'd MMM yyyy')}
                  </p>
                </div>
                <StatusBadge status={r.status} type="reservation" className="shrink-0" />
                <button
                  onClick={() => setConfirmCancel(r)}
                  disabled={busyId === r.id}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-body hover:bg-surface-hover disabled:opacity-50"
                >
                  {busyId === r.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface shadow-xl">
            <div className="px-6 py-5">
              <h2 className="font-semibold text-ink">Cancel this booking?</h2>
              <p className="mt-1.5 text-sm text-ink-body">
                {names(confirmCancel.itemIds)} will be released for {format(confirmCancel.startDate.toDate(), 'd MMM')}
                {' → '}{format(confirmCancel.endDate.toDate(), 'd MMM yyyy')}. This can't be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-line-subtle px-6 py-4">
              <button
                onClick={() => setConfirmCancel(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink-body hover:bg-surface-hover"
              >
                Keep it
              </button>
              <button
                onClick={() => cancel(confirmCancel)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Cancel booking
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReturn && (
        <ConditionModal
          checkoutId={confirmReturn.id}
          itemIds={confirmReturn.itemIds}
          targetName={names(confirmReturn.itemIds)}
          mode="return"
          reservationId={confirmReturn.reservationId}
          onClose={() => setConfirmReturn(null)}
          onConfirm={() => {
            setConfirmReturn(null);
            toast.success('Returned successfully');
          }}
        />
      )}
    </div>
  );
}
