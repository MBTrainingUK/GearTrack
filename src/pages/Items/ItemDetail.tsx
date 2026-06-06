import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Checkout, Reservation } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import { ArrowLeft, Edit, MapPin, PoundSterling, Hash, Clock, AlertTriangle } from 'lucide-react';
import ConditionBadge from '../../components/ConditionBadge';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<(Checkout | Reservation)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getDoc(doc(db, 'items', id)),
      getDocs(
        query(collection(db, 'checkouts'), where('itemIds', 'array-contains', id))
      ),
    ]).then(([itemSnap, checkoutsSnap]) => {
      if (itemSnap.exists()) setItem({ id: itemSnap.id, ...itemSnap.data() } as Item);
      const sorted = checkoutsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Checkout))
        .sort((a, b) => (b.checkedOutAt?.toMillis() ?? 0) - (a.checkedOutAt?.toMillis() ?? 0));
      setHistory(sorted);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Item not found</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
        <StatusBadge status={item.status} type="item" />
        <div className="ml-auto flex gap-2">
          <Link
            to={`/reservations/new?itemId=${item.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reserve
          </Link>
          <Link
            to={`/items/${item.id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Edit size={14} />
            Edit
          </Link>
        </div>
      </div>

      <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Details</h2>
              <ConditionBadge condition={item.condition} />
            </div>
            {item.condition && item.condition !== 'good' && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle size={14} className="shrink-0" />
                This item is marked as <strong className="mx-1">{item.condition === 'needs_attention' ? 'Needs attention' : 'Damaged'}</strong> and is blocked from booking.
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoRow icon={Hash} label="Category" value={item.category} />
              {item.assetNumber && <InfoRow icon={Hash} label="Asset No." value={item.assetNumber} />}
              {item.serialNumber && <InfoRow icon={Hash} label="Serial No." value={item.serialNumber} />}
              {item.location && <InfoRow icon={MapPin} label="Location" value={item.location} />}
              {item.purchasePrice && (
                <InfoRow icon={PoundSterling} label="Value" value={`£${item.purchasePrice.toLocaleString('en-GB')}`} />
              )}
            </dl>
            {item.description && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700">{item.description}</p>
              </div>
            )}
            {item.notes && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-600">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Checkout history */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={15} /> Checkout History
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">No checkout history yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(history as Checkout[]).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{c.userName}</p>
                      <p className="text-xs text-gray-500">
                        {formatTS(c.checkedOutAt)} → {c.returnedAt ? formatTS(c.returnedAt) : 'Active'}
                      </p>
                    </div>
                    <StatusBadge status={c.status} type="checkout" />
                  </li>
                ))}
              </ul>
            )}
          </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="mt-0.5 shrink-0 text-gray-400" />
      <div>
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="font-medium text-gray-900">{value}</dd>
      </div>
    </div>
  );
}

function formatTS(ts: Timestamp | undefined) {
  if (!ts) return '—';
  try {
    return format(ts.toDate(), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}
