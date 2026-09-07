import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { Checkout, Item, Reservation, Kit, CheckoutType } from '../../types';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, AlertTriangle, X, Check, Zap, AlertCircle, Home, Briefcase } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import ConditionModal from '../../components/ConditionModal';
import { format, subDays, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { writeAuditLog } from '../../lib/auditLog';
import { isOverdue, createCheckout, isPersonal, AVAILABILITY_DECLARATION, LIABILITY_DECLARATION, PERSONAL_DECLARATIONS_VERSION } from '../../lib/checkout';
import { isFlagged, isCategoryExcluded } from '../../lib/items';
import { useItems } from '../../store/items';
import { useCategories } from '../../store/categories';

export default function CheckoutsList() {
  const { appUser, currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const reservationId = searchParams.get('reservationId');
  const returnId = searchParams.get('returnId');

  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const { items: itemsList, byId: items } = useItems();
  const [kits, setKits] = useState<Record<string, Kit>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'overdue' | 'returned'>('all');
  const [userFilter, setUserFilter] = useState<'mine' | 'all'>('mine');
  const [dateRange, setDateRange] = useState<30 | 90>(30);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Checkout | null>(null);
  const [conditionModal, setConditionModal] = useState<{
    checkoutId: string;
    itemIds: string[];
    targetName: string;
    mode: 'checkout' | 'return';
    reservationId?: string;
  } | null>(null);
  const [showNewModal, setShowNewModal] = useState(Boolean(reservationId));

  useEffect(() => {
    if (!appUser?.orgId) return;
    const orgId = appUser.orgId;
    const unsubs = [
      onSnapshot(
        query(collection(db, 'checkouts'), where('orgId', '==', orgId), orderBy('checkedOutAt', 'desc')),
        (s) => setCheckouts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout))),
        (err) => console.error('Checkouts query failed:', err)
      ),
      onSnapshot(query(collection(db, 'kits'), where('orgId', '==', orgId)), (s) => {
        const map: Record<string, Kit> = {};
        s.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } as Kit; });
        setKits(map);
      }, (err) => console.error('Kits query failed:', err)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [appUser?.orgId]);

  // Open the return dialog once when arriving via ?returnId=…, then strip the
  // param. `checkouts` is a live snapshot array whose identity changes on every
  // Firestore update, so without consuming the param here, dismissing the
  // dialog only lasted until the next unrelated write re-ran this effect and
  // reopened it.
  useEffect(() => {
    if (!returnId || checkouts.length === 0) return;
    const c = checkouts.find((ch) => ch.id === returnId && ch.status === 'active');
    if (!c) return;
    const names = c.itemIds.slice(0, 2).map((id) => items[id]?.name ?? 'Item').join(', ');
    const extra = c.itemIds.length > 2 ? ` +${c.itemIds.length - 2} more` : '';
    // Consuming a one-shot deep link: the param is stripped immediately below,
    // so this runs once on arrival rather than cascading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConditionModal({ checkoutId: c.id, itemIds: c.itemIds, targetName: names + extra, mode: 'return', reservationId: c.reservationId ?? undefined });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('returnId');
        return next;
      },
      { replace: true }
    );
  }, [returnId, checkouts, items, setSearchParams]);

  const cutoff = subDays(new Date(), dateRange);
  const dateFiltered = checkouts.filter((c) => {
    if (c.status !== 'returned' && c.status !== 'declined') return true;
    const ts = c.returnedAt ?? c.declinedAt ?? c.checkedOutAt;
    try { return ts.toDate() >= cutoff; } catch { return true; }
  });

  const userFiltered =
    userFilter === 'mine'
      ? dateFiltered.filter((c) => c.userId === currentUser?.uid)
      : dateFiltered;
  const filtered = userFiltered.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isOverdue(c);
    if (filter === 'active') return c.status === 'active' && !isOverdue(c);
    if (filter === 'pending') return c.status === 'pending_approval';
    return c.status === filter;
  });

  const overdue = checkouts.filter(isOverdue).length;
  const pendingApproval = checkouts.filter((c) => c.status === 'pending_approval');
  const isAdmin = appUser?.role === 'admin';

  async function decide(checkout: Checkout, approve: boolean, reason?: string) {
    setDecidingId(checkout.id);
    try {
      await httpsCallable<{ checkoutId: string; reason?: string }, { checkoutId: string }>(
        functions,
        approve ? 'approveCheckout' : 'declineCheckout'
      )({ checkoutId: checkout.id, ...(reason ? { reason } : {}) });
      toast.success(
        approve
          ? `Approved — ${checkout.userName} has been emailed`
          : `Declined — the gear is available again`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record that decision');
    } finally {
      setDecidingId(null);
    }
  }

  async function cancelRequest(checkout: Checkout) {
    setDecidingId(checkout.id);
    try {
      await httpsCallable<{ checkoutId: string }, { checkoutId: string }>(
        functions,
        'cancelCheckoutRequest'
      )({ checkoutId: checkout.id });
      toast.success('Request withdrawn — the gear is available again');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw the request');
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkouts</h1>
          <p className="mt-0.5 text-sm text-gray-500">{filtered.length} total</p>
        </div>
        {/* Open to every role: a personal checkout is a request, not an approval,
            and the rules already allow anyone to check gear out to themselves. */}
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Checkout
        </button>
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{overdue} overdue</span> checkout{overdue > 1 ? 's' : ''} require attention.
          </p>
        </div>
      )}

      {isAdmin && pendingApproval.length > 0 && (
        <button
          onClick={() => { setFilter('pending'); setUserFilter('all'); }}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100"
        >
          <Home size={16} className="shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            <span className="font-semibold">
              {pendingApproval.length} personal checkout{pendingApproval.length > 1 ? 's' : ''}
            </span>{' '}
            awaiting your approval — this gear is held until you decide.
          </p>
        </button>
      )}

      {/* Filter tabs + date range toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Owner filter */}
          {(['mine', 'all'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUserFilter(u)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                userFilter === u
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {u === 'mine' ? 'Mine' : 'Everyone'}
            </button>
          ))}
          <div className="h-4 w-px bg-gray-200" />
          {/* Status filter */}
          {(['all', 'pending', 'active', 'overdue', 'returned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {f === 'pending' ? 'Awaiting approval' : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">Show:</span>
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            {([30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  dateRange === d ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {d === 30 ? 'Last 30 days' : 'Last 90 days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-400">No checkouts found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-5 py-3 text-left font-medium">User</th>
                <th className="px-5 py-3 text-left font-medium">Items</th>
                <th className="px-5 py-3 text-left font-medium">Checked Out</th>
                <th className="px-5 py-3 text-left font-medium">Due</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => {
                const overdueRow = isOverdue(c);
                const displayStatus = overdueRow ? 'overdue' : c.status;
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${overdueRow ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{c.userName}</p>
                        {isPersonal(c) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-800">
                            <Home size={10} />
                            Personal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{c.userEmail}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        {c.itemIds.slice(0, 2).map((id) => (
                          <Link key={id} to={`/items/${id}`} className="block text-xs text-blue-600 hover:underline">
                            {items[id]?.name ?? id}
                          </Link>
                        ))}
                        {c.itemIds.length > 2 && (
                          <span className="text-xs text-gray-400">+{c.itemIds.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatTS(c.checkedOutAt)}</td>
                    <td className={`px-5 py-3 ${overdueRow ? 'font-semibold text-red-700' : 'text-gray-600'}`}>
                      {formatTS(c.dueDate)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={displayStatus} type="checkout" />
                    </td>
                    <td className="px-5 py-3">
                      {c.status === 'pending_approval' && (
                        <div className="flex items-center gap-1.5">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => decide(c, true)}
                                disabled={decidingId === c.id}
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setDeclineTarget(c)}
                                disabled={decidingId === c.id}
                                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {!isAdmin && c.userId === currentUser?.uid && (
                            <button
                              onClick={() => cancelRequest(c)}
                              disabled={decidingId === c.id}
                              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Withdraw
                            </button>
                          )}
                        </div>
                      )}
                      {c.status === 'active' && appUser?.role !== 'user' && (
                        <button
                          onClick={() => {
                            const names = c.itemIds.slice(0, 2).map((id) => items[id]?.name ?? 'Item').join(', ');
                            const extra = c.itemIds.length > 2 ? ` +${c.itemIds.length - 2} more` : '';
                            setConditionModal({ checkoutId: c.id, itemIds: c.itemIds, targetName: names + extra, mode: 'return', reservationId: c.reservationId ?? undefined });
                          }
                          }
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                        >
                          Check In
                        </button>
                      )}
                      {c.status === 'returned' && c.returnCondition && (
                        <span className="text-xs text-gray-400 capitalize">
                          Returned: {c.returnCondition.condition}
                        </span>
                      )}
                      {c.status === 'declined' && (
                        <span className="text-xs text-gray-400">
                          {c.declineReason || 'Declined'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Condition modal (check-in) */}
      {conditionModal && (
        <ConditionModal
          checkoutId={conditionModal.checkoutId}
          itemIds={conditionModal.itemIds}
          targetName={conditionModal.targetName}
          mode={conditionModal.mode}
          reservationId={conditionModal.reservationId}
          onClose={() => setConditionModal(null)}
          onConfirm={() => {
            const mode = conditionModal.mode;
            setConditionModal(null);
            toast.success(mode === 'checkout' ? 'Items checked out successfully' : 'Items checked in successfully');
          }}
        />
      )}

      {/* New checkout modal */}
      {showNewModal && (
        <NewCheckoutModal
          items={itemsList}
          kits={Object.values(kits)}
          reservationId={reservationId ?? undefined}
          onClose={() => setShowNewModal(false)}
          onCreated={(wasPersonal) => {
            setShowNewModal(false);
            toast.success(
              wasPersonal
                ? 'Request sent — an admin has been emailed to approve it'
                : 'Items checked out successfully'
            );
          }}
        />
      )}

      {declineTarget && (
        <DeclineModal
          checkout={declineTarget}
          onClose={() => setDeclineTarget(null)}
          onConfirm={(reason) => {
            const target = declineTarget;
            setDeclineTarget(null);
            void decide(target, false, reason);
          }}
        />
      )}
    </div>
  );
}

function DeclineModal({
  checkout,
  onClose,
  onConfirm,
}: {
  checkout: Checkout;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Decline personal checkout?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-6 py-4">
          <p className="text-sm text-gray-700">
            <strong>{checkout.userName}</strong> will be emailed and the gear will go back into the
            available pool.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Shared with the requester"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

function NewCheckoutModal({
  items,
  kits,
  reservationId,
  onClose,
  onCreated,
}: {
  items: Item[];
  kits: Kit[];
  reservationId?: string;
  onClose: () => void;
  onCreated: (wasPersonal: boolean) => void;
}) {
  const { currentUser, appUser } = useAuth();
  const { excludedCategories } = useCategories();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [checkoutTab, setCheckoutTab] = useState<'items' | 'kit'>('items');
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [kitWarnings, setKitWarnings] = useState<string[]>([]);
  // A checkout against an existing reservation is work by definition.
  const [kind, setKind] = useState<CheckoutType>('work');
  const [personalReason, setPersonalReason] = useState('');
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const isPersonalRequest = kind === 'personal' && !reservationId;
  const declarationsAccepted = availabilityChecked && liabilityAccepted;

  useEffect(() => {
    if (!reservationId) return;
    getDoc(doc(db, 'reservations', reservationId)).then((snap) => {
      if (snap.exists()) {
        const r = snap.data() as Reservation;
        setSelectedItems(r.itemIds);
        // If the reservation's end date has passed, default to end of today
        const end = r.endDate.toDate();
        const due = end < new Date() ? endOfDay(new Date()) : end;
        setDueDate(format(due, "yyyy-MM-dd'T'HH:mm"));
      }
    });
  }, [reservationId]);

  function selectKit(kit: Kit) {
    const available: string[] = [];
    const warned: string[] = [];
    kit.itemIds.forEach((id) => {
      const item = items.find((i) => i.id === id);
      if (!item || isFlagged(item) || isCategoryExcluded(item, excludedCategories) || item.status !== 'available') {
        warned.push(item?.name ?? id);
      } else {
        available.push(id);
      }
    });
    setSelectedKitId(kit.id);
    setSelectedItems(available);
    setKitWarnings(warned);
  }

  function checkoutName(itemIds: string[]) {
    return selectedKitId
      ? (kits.find((k) => k.id === selectedKitId)?.name ?? 'Kit')
      : itemIds.slice(0, 2).map((id) => items.find((i) => i.id === id)?.name ?? 'Item').join(', ') +
        (itemIds.length > 2 ? ` +${itemIds.length - 2} more` : '');
  }

  async function create(itemIds: string[], due: Timestamp, checkoutNotes: string, linkReservation: boolean) {
    if (!currentUser || !appUser) return;
    setSaving(true);
    try {
      const id = await createCheckout({
        orgId: appUser.orgId,
        reservationId: linkReservation ? reservationId ?? null : null,
        kitId: selectedKitId ?? null,
        userId: currentUser.uid,
        userName: appUser.displayName,
        userEmail: appUser.email,
        itemIds,
        dueDate: due,
        notes: checkoutNotes,
        type: isPersonalRequest ? 'personal' : 'work',
        ...(isPersonalRequest
          ? {
              personalReason,
              declarations: {
                availabilityChecked,
                liabilityAccepted,
                version: PERSONAL_DECLARATIONS_VERSION,
              },
            }
          : {}),
      });
      const name = checkoutName(itemIds);
      await writeAuditLog({
        orgId: appUser.orgId,
        action: isPersonalRequest ? 'request_personal_checkout' : 'checkout',
        performedBy: currentUser.uid,
        performedByName: appUser.displayName,
        targetType: 'checkout',
        targetId: id,
        targetName: name,
      });
      onCreated(isPersonalRequest);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create checkout');
    } finally {
      setSaving(false);
    }
  }

  async function quickGrab(itemIds: string[]) {
    if (itemIds.length === 0) return;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 0, 0);
    await create(itemIds, Timestamp.fromDate(endOfToday), 'Quick Grab', false);
  }

  async function handleSubmit() {
    if (selectedItems.length === 0 || !dueDate) {
      toast.error('Select items and due date');
      return;
    }
    if (isPersonalRequest && !personalReason.trim()) {
      toast.error('Add a reason for the personal checkout');
      return;
    }
    if (isPersonalRequest && !declarationsAccepted) {
      toast.error('Accept both declarations before requesting approval');
      return;
    }
    await create(selectedItems, Timestamp.fromDate(new Date(dueDate)), notes, true);
  }

  const available = items.filter(
    (i) =>
      (i.status === 'available' || selectedItems.includes(i.id)) &&
      !isFlagged(i) &&
      !isCategoryExcluded(i, excludedCategories) &&
      (i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.assetNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (i.serialNumber ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="font-semibold text-gray-900">
            {isPersonalRequest ? 'Personal Checkout Request' : 'New Checkout'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {!reservationId && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Checkout type</label>
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setKind('work')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${kind === 'work' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <Briefcase size={12} />
                  Work
                </button>
                <button
                  type="button"
                  onClick={() => setKind('personal')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${kind === 'personal' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <Home size={12} />
                  Personal
                </button>
              </div>
              {isPersonalRequest && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800">
                  <AlertCircle size={12} className="mt-0.5 shrink-0 text-purple-600" />
                  <span>
                    An admin must approve this before you can take it. The gear is held for you in
                    the meantime.
                  </span>
                </div>
              )}
            </div>
          )}
          {isPersonalRequest && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reason for personal use *
              </label>
              <textarea
                value={personalReason}
                onChange={(e) => setPersonalReason(e.target.value)}
                rows={2}
                placeholder="Shown to the admin who approves it"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Due Date *</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            {!reservationId && (
              <div className="mb-3 flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => { setCheckoutTab('items'); setSelectedKitId(null); setSelectedItems([]); setKitWarnings([]); }}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${checkoutTab === 'items' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Individual Items
                </button>
                <button
                  type="button"
                  onClick={() => { setCheckoutTab('kit'); setSelectedItems([]); setSelectedKitId(null); setKitWarnings([]); }}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${checkoutTab === 'kit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Kit
                </button>
              </div>
            )}

            {checkoutTab === 'items' ? (
              <>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Items ({selectedItems.length} selected) *
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, asset no, serial no…"
                  className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {available.map((item) => {
                    const isSel = selectedItems.includes(item.id);
                    return (
                      <div key={item.id} className={`flex w-full items-center justify-between px-3 py-2 text-sm ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedItems((p) => p.includes(item.id) ? p.filter((x) => x !== item.id) : [...p, item.id])}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="font-medium text-gray-900 truncate">{item.name}</p>
                          {(item.assetNumber || item.serialNumber) && (
                            <p className="text-xs text-gray-400">{item.assetNumber ? `Asset: ${item.assetNumber}` : `S/N: ${item.serialNumber}`}</p>
                          )}
                        </button>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {/* Quick Grab is a same-day work loan, so it has no place in an approval flow. */}
                          {!isPersonalRequest && (
                            <button
                              type="button"
                              title="Quick Grab — check out now, due end of today"
                              onClick={() => quickGrab([item.id])}
                              disabled={saving}
                              className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              <Zap size={11} />
                              Quick Grab
                            </button>
                          )}
                          {isSel && <Check size={13} className="text-blue-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Select a Kit</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {kits.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-400">No kits available</p>
                  ) : (
                    kits.map((kit) => {
                      const availableCount = kit.itemIds.filter((id) => {
                        const item = items.find((i) => i.id === id);
                        return item && item.status === 'available' && !isFlagged(item);
                      }).length;
                      const isSelected = selectedKitId === kit.id;
                      return (
                        <button
                          key={kit.id}
                          type="button"
                          onClick={() => selectKit(kit)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                        >
                          <p className="text-sm font-medium text-gray-900">{kit.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {availableCount} of {kit.itemIds.length} items available
                          </p>
                        </button>
                      );
                    })
                  )}
                  {checkoutTab === 'kit' && kitWarnings.length > 0 && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertCircle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                      <span>
                        <strong>{kitWarnings.join(', ')}</strong>{' '}
                        {kitWarnings.length === 1 ? 'is' : 'are'} unavailable and won't be included.
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {isPersonalRequest && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Declarations *</p>

              <label
                className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${availabilityChecked ? 'border-purple-300 bg-purple-50/60' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={availabilityChecked}
                  onChange={(e) => setAvailabilityChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs leading-relaxed text-gray-700">
                  {AVAILABILITY_DECLARATION.intro}
                  <ul className="mt-1.5 list-disc space-y-1 pl-4">
                    {AVAILABILITY_DECLARATION.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <span className="mt-1.5 block font-medium text-gray-900">
                    {AVAILABILITY_DECLARATION.accept}
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${liabilityAccepted ? 'border-purple-300 bg-purple-50/60' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={liabilityAccepted}
                  onChange={(e) => setLiabilityAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs leading-relaxed text-gray-700">
                  {LIABILITY_DECLARATION.text}
                  <span className="mt-1.5 block font-medium text-gray-900">
                    {LIABILITY_DECLARATION.accept}
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          {selectedItems.length > 0 && !isPersonalRequest && (
            <button
              onClick={() => quickGrab(selectedItems)}
              disabled={saving}
              title="Check out now, due end of today"
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
            >
              <Zap size={14} />
              Quick Grab
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving || (isPersonalRequest && !declarationsAccepted)}
            title={isPersonalRequest && !declarationsAccepted ? 'Accept both declarations first' : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${isPersonalRequest ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {saving
              ? isPersonalRequest ? 'Sending…' : 'Creating…'
              : isPersonalRequest ? 'Request approval' : 'Check Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTS(ts: Timestamp) {
  try {
    return format(ts.toDate(), 'MMM d, yyyy h:mm a');
  } catch {
    return '—';
  }
}
