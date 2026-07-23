import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/useAuth';
import type { Item } from '../../types';
import { writeAuditLog } from '../../lib/auditLog';
import { createCheckout } from '../../lib/checkout';
import { isFlagged, isCategoryExcluded } from '../../lib/items';
import { useItems } from '../../store/items';
import { useCategories } from '../../store/categories';
import { Search, Package, X, Loader2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Browse() {
  const { currentUser, appUser } = useAuth();
  const { items } = useItems();
  const { excludedCategories } = useCategories();
  const [query, setQuery] = useState('');
  const [checkoutItem, setCheckoutItem] = useState<Item | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const filtered = items.filter((item) => {
    if (item.status !== 'available' || isFlagged(item) || isCategoryExcluded(item, excludedCategories)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.assetNumber?.toLowerCase().includes(q) ||
      item.serialNumber?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  async function confirmQuickGrab() {
    if (!checkoutItem || !currentUser || !appUser) return;
    setCheckingOut(true);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 0, 0);
    try {
      const checkoutId = await createCheckout({
        orgId: appUser.orgId,
        userId: currentUser.uid,
        userName: appUser.displayName,
        userEmail: appUser.email,
        itemIds: [checkoutItem.id],
        dueDate: Timestamp.fromDate(endOfToday),
        notes: 'Quick Grab',
      });
      await writeAuditLog({
        orgId: appUser.orgId,
        action: 'checkout',
        performedBy: currentUser.uid,
        performedByName: appUser.displayName,
        targetType: 'checkout',
        targetId: checkoutId,
        targetName: checkoutItem.name,
        details: { source: 'mobile', quickGrab: 'true' },
      });
      toast.success(`${checkoutItem.name} grabbed — due end of today`);
      setCheckoutItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed — try again');
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
              className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
            >
              <Zap size={12} />
              Quick Grab
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
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500">Due back by end of today.</p>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setCheckoutItem(null)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmQuickGrab}
                disabled={checkingOut}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkingOut ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Quick Grab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
