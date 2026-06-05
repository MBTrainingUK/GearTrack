import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Checkout, Item, Reservation } from '../../types';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, AlertTriangle, X, Check } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import ConditionModal from '../../components/ConditionModal';
import { format, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function CheckoutsList() {
  const { appUser } = useAuth();
  const [searchParams] = useSearchParams();
  const reservationId = searchParams.get('reservationId');

  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [conditionModal, setConditionModal] = useState<{
    checkoutId: string;
    itemIds: string[];
    mode: 'checkout' | 'return';
  } | null>(null);
  const [showNewModal, setShowNewModal] = useState(Boolean(reservationId));

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, 'checkouts'), orderBy('checkedOutAt', 'desc')),
        (s) => setCheckouts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)))
      ),
      onSnapshot(collection(db, 'items'), (s) => {
        const map: Record<string, Item> = {};
        s.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } as Item; });
        setItems(map);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filtered =
    filter === 'all' ? checkouts : checkouts.filter((c) => c.status === filter);

  const overdue = checkouts.filter((c) => c.status === 'active' && isPast(c.dueDate.toDate())).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkouts</h1>
          <p className="mt-0.5 text-sm text-gray-500">{checkouts.length} total</p>
        </div>
        {appUser?.role !== 'user' && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            New Checkout
          </button>
        )}
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{overdue} overdue</span> checkout{overdue > 1 ? 's' : ''} require attention.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'overdue', 'returned'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {f}
          </button>
        ))}
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
                const isOverdue = c.status === 'active' && isPast(c.dueDate.toDate());
                const displayStatus = isOverdue ? 'overdue' : c.status;
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{c.userName}</p>
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
                    <td className={`px-5 py-3 ${isOverdue ? 'font-semibold text-red-700' : 'text-gray-600'}`}>
                      {formatTS(c.dueDate)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={displayStatus} type="checkout" />
                    </td>
                    <td className="px-5 py-3">
                      {c.status === 'active' && appUser?.role !== 'user' && (
                        <button
                          onClick={() =>
                            setConditionModal({ checkoutId: c.id, itemIds: c.itemIds, mode: 'return' })
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
          mode={conditionModal.mode}
          onClose={() => setConditionModal(null)}
          onConfirm={() => {
            setConditionModal(null);
            toast.success('Items checked in successfully');
          }}
        />
      )}

      {/* New checkout modal */}
      {showNewModal && (
        <NewCheckoutModal
          items={Object.values(items)}
          reservationId={reservationId ?? undefined}
          onClose={() => setShowNewModal(false)}
          onCreated={(id, itemIds) => {
            setShowNewModal(false);
            setConditionModal({ checkoutId: id, itemIds, mode: 'checkout' });
          }}
        />
      )}
    </div>
  );
}

function NewCheckoutModal({
  items,
  reservationId,
  onClose,
  onCreated,
}: {
  items: Item[];
  reservationId?: string;
  onClose: () => void;
  onCreated: (id: string, itemIds: string[]) => void;
}) {
  const { currentUser, appUser } = useAuth();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!reservationId) return;
    getDoc(doc(db, 'reservations', reservationId)).then((snap) => {
      if (snap.exists()) {
        const r = snap.data() as Reservation;
        setSelectedItems(r.itemIds);
        setDueDate(r.endDate.toDate().toISOString().slice(0, 16));
      }
    });
  }, [reservationId]);

  async function handleSubmit() {
    if (!currentUser || !appUser || selectedItems.length === 0 || !dueDate) {
      toast.error('Select items and due date');
      return;
    }
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'checkouts'), {
        reservationId: reservationId ?? null,
        userId: currentUser.uid,
        userName: appUser.displayName,
        userEmail: appUser.email,
        itemIds: selectedItems,
        checkedOutAt: serverTimestamp(),
        dueDate: Timestamp.fromDate(new Date(dueDate)),
        status: 'active',
        notes,
      });
      // Update item statuses
      for (const itemId of selectedItems) {
        await updateDoc(doc(db, 'items', itemId), {
          status: 'checked_out',
          updatedAt: serverTimestamp(),
        });
      }
      // Update reservation status if linked
      if (reservationId) {
        await updateDoc(doc(db, 'reservations', reservationId), {
          status: 'checked_out',
          updatedAt: serverTimestamp(),
        });
      }
      onCreated(docRef.id, selectedItems);
    } catch {
      toast.error('Failed to create checkout');
    } finally {
      setSaving(false);
    }
  }

  const available = items.filter(
    (i) =>
      (i.status === 'available' || selectedItems.includes(i.id)) &&
      i.condition !== 'needs_attention' &&
      i.condition !== 'damaged' &&
      i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="font-semibold text-gray-900">New Checkout</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-4">
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Items ({selectedItems.length} selected) *
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available items…"
              className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {available.map((item) => {
                const isSel = selectedItems.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedItems((p) =>
                        p.includes(item.id) ? p.filter((x) => x !== item.id) : [...p, item.id]
                      )
                    }
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 ${isSel ? 'bg-blue-50' : ''}`}
                  >
                    <span className="text-gray-900">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} type="item" />
                      {isSel && <Check size={13} className="text-blue-600" />}
                    </div>
                  </button>
                );
              })}
            </div>
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
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Check Out & Add Condition Report'}
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
