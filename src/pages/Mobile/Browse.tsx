import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/useAuth';
import type { Item } from '../../types';
import { writeAuditLog } from '../../lib/auditLog';
import { Search, Package, X, Loader2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Browse() {
  const { currentUser, appUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [checkoutItem, setCheckoutItem] = useState<Item | null>(null);
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
    });
  }, []);

  const filtered = items.filter((item) => {
    if (item.status !== 'available') return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.assetNumber?.toLowerCase().includes(q) ||
      item.serialNumber?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  async function confirmCheckout() {
    if (!checkoutItem || !currentUser || !appUser) return;
    setCheckingOut(true);
    try {
      const due = Timestamp.fromDate(new Date(dueDate + 'T23:59:59'));
      await addDoc(collection(db, 'checkouts'), {
        userId: currentUser.uid,
        userName: appUser.displayName,
        userEmail: appUser.email,
        itemIds: [checkoutItem.id],
        checkedOutAt: serverTimestamp(),
        dueDate: due,
        status: 'active',
      });
      await updateDoc(doc(db, 'items', checkoutItem.id), { status: 'checked_out' });
      await writeAuditLog({
        action: 'checkout',
        performedBy: currentUser.uid,
        performedByName: appUser.displayName,
        targetType: 'checkout',
        targetId: checkoutItem.id,
        targetName: checkoutItem.name,
        details: { source: 'mobile', due: format(new Date(dueDate), 'd MMM yyyy') },
      });
      toast.success(`${checkoutItem.name} checked out`);
      setCheckoutItem(null);
      setDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    } catch {
      toast.error('Checkout failed — try again');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="sticky top-0 bg-gray-50 px-4 pt-4 pb-3 z-10">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or asset number…"
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {query && (
          <p className="mt-2 text-xs text-gray-400">
            {filtered.length} available result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {!query && (
          <p className="text-xs text-gray-400 mb-3">Showing all available items</p>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Package size={40} className="text-gray-200" />
            <p className="text-sm text-gray-400">
              {query ? 'No available items match that search' : 'No items available right now'}
            </p>
          </div>
        )}

        {filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-gray-900 truncate">{item.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {item.assetNumber && (
                  <span className="text-xs text-gray-400">#{item.assetNumber}</span>
                )}
                {item.category && (
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{item.category}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setCheckoutItem(item)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Check Out
            </button>
          </div>
        ))}
      </div>

      {/* Checkout modal */}
      {checkoutItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setCheckoutItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">{checkoutItem.name}</h2>
                {checkoutItem.assetNumber && (
                  <p className="text-xs text-gray-400">#{checkoutItem.assetNumber}</p>
                )}
              </div>
              <button onClick={() => setCheckoutItem(null)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setCheckoutItem(null)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckout}
                disabled={checkingOut}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkingOut && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
