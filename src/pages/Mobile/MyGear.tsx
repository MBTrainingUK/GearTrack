import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/useAuth';
import type { Checkout } from '../../types';
import { isOverdue } from '../../lib/checkout';
import { useItems } from '../../store/items';
import { format } from 'date-fns';
import { PackageCheck, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConditionModal from '../../components/ConditionModal';

export default function MyGear() {
  const { currentUser, appUser } = useAuth();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const { byId: items } = useItems();
  const [loading, setLoading] = useState(true);
  const [confirmReturn, setConfirmReturn] = useState<Checkout | null>(null);

  useEffect(() => {
    if (!currentUser || !appUser?.orgId) return;
    const q = query(
      collection(db, 'checkouts'),
      where('orgId', '==', appUser.orgId),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setCheckouts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)));
      setLoading(false);
    });
    return unsub;
  }, [currentUser, appUser?.orgId]);

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
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <RotateCcw size={14} />
                Return
              </button>
            </div>
          </div>
        );
      })}

      {confirmReturn && (
        <ConditionModal
          checkoutId={confirmReturn.id}
          itemIds={confirmReturn.itemIds}
          targetName={itemNamesFor(confirmReturn)}
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
