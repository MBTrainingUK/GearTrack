import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/useAuth';
import type { Checkout, Item } from '../../types';
import { isOverdue } from '../../lib/checkout';
import { writeAuditLog } from '../../lib/auditLog';
import { format } from 'date-fns';
import { PackageCheck, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyGear() {
  const { currentUser, appUser } = useAuth();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [loading, setLoading] = useState(true);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [confirmReturn, setConfirmReturn] = useState<Checkout | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'checkouts'),
      where('userId', '==', currentUser.uid),
      where('status', 'in', ['active', 'overdue']),
    );
    const unsub = onSnapshot(q, (snap) => {
      setCheckouts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)));
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items'), (snap) => {
      const map: Record<string, Item> = {};
      snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } as Item; });
      setItems(map);
    });
    return unsub;
  }, []);

  async function returnCheckout(checkout: Checkout) {
    setReturningId(checkout.id);
    setConfirmReturn(null);
    try {
      await updateDoc(doc(db, 'checkouts', checkout.id), {
        status: 'returned',
        returnedAt: serverTimestamp(),
      });
      await Promise.all(
        checkout.itemIds.map((id) => updateDoc(doc(db, 'items', id), { status: 'available' }))
      );
      const itemNames = checkout.itemIds
        .map((id) => items[id]?.name ?? id)
        .join(', ');
      await writeAuditLog({
        action: 'return',
        userId: currentUser!.uid,
        userName: appUser!.displayName,
        targetId: checkout.id,
        targetName: itemNames,
        details: `Returned via mobile`,
      });
      toast.success('Returned successfully');
    } catch {
      toast.error('Failed to return — try again');
    } finally {
      setReturningId(null);
    }
  }

  function itemNamesFor(checkout: Checkout) {
    return checkout.itemIds.map((id) => items[id]?.name ?? '…').join(', ');
  }

  function assetNumbersFor(checkout: Checkout) {
    const nums = checkout.itemIds
      .map((id) => items[id]?.assetNumber)
      .filter(Boolean);
    return nums.length ? nums.join(', ') : null;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <PackageCheck size={18} className="text-blue-600" />
        <h1 className="text-lg font-bold text-gray-900">My Gear</h1>
        {checkouts.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{checkouts.length} item{checkouts.length !== 1 ? 's' : ''} out</span>
        )}
      </div>

      {checkouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <PackageCheck size={40} className="text-gray-200" />
          <p className="text-sm text-gray-400">Nothing checked out right now</p>
        </div>
      )}

      {checkouts.map((co) => {
        const overdue = isOverdue(co);
        const dueDate = co.dueDate?.toDate();
        return (
          <div
            key={co.id}
            className={`rounded-xl bg-white border shadow-sm p-4 space-y-3 ${overdue ? 'border-red-200' : 'border-gray-100'}`}
          >
            <div className="space-y-0.5">
              <p className="font-semibold text-gray-900 leading-snug">{itemNamesFor(co)}</p>
              {assetNumbersFor(co) && (
                <p className="text-xs text-gray-400">#{assetNumbersFor(co)}</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                {dueDate && (
                  <p className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {overdue ? 'Overdue — ' : 'Due '}
                    {format(dueDate, 'd MMM yyyy')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setConfirmReturn(co)}
                disabled={returningId === co.id}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {returningId === co.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RotateCcw size={14} />}
                Return
              </button>
            </div>
          </div>
        );
      })}

      {/* Return confirmation */}
      {confirmReturn && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setConfirmReturn(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2 space-y-1">
              <h2 className="font-semibold text-gray-900">Return gear?</h2>
              <p className="text-sm text-gray-500">{itemNamesFor(confirmReturn)}</p>
            </div>
            <div className="flex gap-3 px-6 py-4">
              <button
                onClick={() => setConfirmReturn(null)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => returnCheckout(confirmReturn)}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
