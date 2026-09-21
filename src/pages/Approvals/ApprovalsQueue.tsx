import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useItems } from '../../store/items';
import { usePendingApprovals } from '../../store/approvals';
import {
  approveWorkReservation,
  cancelReservation,
  decidePersonalCheckout,
  decidePersonalReservation,
} from '../../lib/approvals';
import type { Checkout } from '../../types';
import { format } from 'date-fns';
import { CheckCircle2, Home, Briefcase, X } from 'lucide-react';
import toast from 'react-hot-toast';

// A turned-down *work* booking is cancelled, not declined — 'declined' only
// ever applies to personal requests, which are the ones that carry a reason
// and an email back to the requester.
type DeclineTarget =
  | { kind: 'workReservation'; id: string; who: string }
  | { kind: 'personalReservation'; id: string; who: string }
  | { kind: 'checkout'; id: string; who: string };

// Everything waiting on this user's decision, in one queue, so pending work is
// something you're told about rather than something you go looking for.
//
// Managers see work reservations only. Personal bookings and personal checkouts
// are admin-only decisions — showing a manager buttons the server would refuse
// would be worse than not showing the request at all.
export default function ApprovalsQueue() {
  const { currentUser, appUser } = useAuth();
  const { byId: items } = useItems();
  const { workReservations, personalReservations, personalCheckouts, count, canApprove } =
    usePendingApprovals();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null);

  function names(ids: string[]) {
    return ids.map((id) => items[id]?.name ?? '…').join(', ');
  }

  async function run(id: string, work: () => Promise<void>, ok: string) {
    setBusyId(id);
    try {
      await work();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record that decision');
    } finally {
      setBusyId(null);
    }
  }

  if (!canApprove) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface">
        <CheckCircle2 size={36} className="text-ink-ghost" />
        <p className="text-sm text-ink-muted">You don't have anything to approve</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Approvals</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {count === 0 ? 'Nothing waiting' : `${count} waiting on you`}
        </p>
      </div>

      {count === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface">
          <CheckCircle2 size={36} className="text-emerald-300 dark:text-emerald-500/60" />
          <p className="text-sm text-ink-muted">All caught up — nothing needs a decision</p>
        </div>
      )}

      {workReservations.length > 0 && (
        <Group
          icon={<Briefcase size={15} className="text-ink-faint" />}
          title="Work bookings"
          hint="Approving frees the requester to collect the gear on the start date."
        >
          {workReservations.map((r) => (
            <Row
              key={r.id}
              who={r.userName}
              what={names(r.itemIds)}
              when={`${format(r.startDate.toDate(), 'd MMM')} → ${format(r.endDate.toDate(), 'd MMM yyyy')}`}
              busy={busyId === r.id}
              onApprove={() =>
                run(
                  r.id,
                  () =>
                    approveWorkReservation(r.id, `${r.userName}'s reservation`, {
                      uid: currentUser!.uid,
                      appUser: appUser!,
                    }),
                  'Reservation approved'
                )
              }
              onDecline={() => setDeclineTarget({ kind: 'workReservation', id: r.id, who: r.userName })}
              declineLabel="Cancel"
            />
          ))}
        </Group>
      )}

      {personalReservations.length > 0 && (
        <Group
          icon={<Home size={15} className="text-purple-500 dark:text-purple-400" />}
          title="Personal bookings"
          hint="Admin only. The requester accepted the £1000 excess when they raised this."
          tone="purple"
        >
          {personalReservations.map((r) => (
            <Row
              key={r.id}
              who={r.userName}
              what={names(r.itemIds)}
              when={`${format(r.startDate.toDate(), 'd MMM')} → ${format(r.endDate.toDate(), 'd MMM yyyy')}`}
              reason={r.personalReason}
              busy={busyId === r.id}
              onApprove={() =>
                run(r.id, () => decidePersonalReservation(r.id, true), `Approved — ${r.userName} has been emailed`)
              }
              onDecline={() => setDeclineTarget({ kind: 'personalReservation', id: r.id, who: r.userName })}
            />
          ))}
        </Group>
      )}

      {personalCheckouts.length > 0 && (
        <Group
          icon={<Home size={15} className="text-purple-500 dark:text-purple-400" />}
          title="Personal checkouts"
          hint="Admin only. The gear is already held out of circulation while this waits."
          tone="purple"
        >
          {personalCheckouts.map((c: Checkout) => (
            <Row
              key={c.id}
              who={c.userName}
              what={names(c.itemIds)}
              when={c.dueDate ? `Back by ${format(c.dueDate.toDate(), 'd MMM yyyy')}` : undefined}
              reason={c.personalReason}
              busy={busyId === c.id}
              onApprove={() =>
                run(c.id, () => decidePersonalCheckout(c.id, true), `Approved — ${c.userName} has been emailed`)
              }
              onDecline={() => setDeclineTarget({ kind: 'checkout', id: c.id, who: c.userName })}
            />
          ))}
        </Group>
      )}

      {declineTarget && (
        <DeclineModal
          who={declineTarget.who}
          isWork={declineTarget.kind === 'workReservation'}
          onClose={() => setDeclineTarget(null)}
          onConfirm={async (reason) => {
            const t = declineTarget;
            setDeclineTarget(null);
            if (t.kind === 'workReservation') {
              await run(
                t.id,
                () =>
                  cancelReservation(t.id, `${t.who}'s reservation`, {
                    uid: currentUser!.uid,
                    appUser: appUser!,
                  }),
                'Booking cancelled'
              );
              return;
            }
            await run(
              t.id,
              () =>
                t.kind === 'personalReservation'
                  ? decidePersonalReservation(t.id, false, reason)
                  : decidePersonalCheckout(t.id, false, reason),
              `Declined — ${t.who} has been emailed`
            );
          }}
        />
      )}
    </div>
  );
}

function Group({
  icon,
  title,
  hint,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  tone?: 'purple';
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {title}
      </h2>
      <p className="text-xs text-ink-muted">{hint}</p>
      <div
        className={`divide-y divide-line-subtle overflow-hidden rounded-xl border bg-surface shadow-sm ${
          tone === 'purple' ? 'border-purple-200 dark:border-purple-500/30' : 'border-line'
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  who,
  what,
  when,
  reason,
  busy,
  onApprove,
  onDecline,
  declineLabel = 'Decline',
}: {
  who: string;
  what: string;
  when?: string;
  reason?: string;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
  declineLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{who}</p>
        <p className="truncate text-xs text-ink-muted">{what}</p>
        {when && <p className="text-xs text-ink-faint">{when}</p>}
        {reason && <p className="mt-1 text-xs italic text-ink-body">“{reason}”</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={onApprove}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Approve'}
        </button>
        <button
          onClick={onDecline}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-body hover:bg-surface-hover disabled:opacity-50"
        >
          {declineLabel}
        </button>
      </div>
    </div>
  );
}

function DeclineModal({
  who,
  isWork,
  onClose,
  onConfirm,
}: {
  who: string;
  isWork: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-4">
          <h2 className="font-semibold text-ink">
            {isWork ? `Cancel ${who}'s booking` : `Decline ${who}'s request`}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-body"><X size={18} /></button>
        </div>
        <div className="px-6 py-4">
          {isWork ? (
            <p className="text-sm text-ink-body">
              The booking is cancelled and the dates are freed up. Work bookings carry no
              decline reason, so nothing is emailed — let {who} know yourself.
            </p>
          ) : (
            <>
              <label className="mb-1.5 block text-sm font-medium text-ink-label">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Shared with the requester"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-line-subtle px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-body hover:bg-surface-hover">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {isWork ? 'Cancel booking' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
