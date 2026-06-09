import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Checkout } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import { ArrowLeft, Edit, MapPin, PoundSterling, Hash, Clock, AlertTriangle, CalendarDays, Gauge } from 'lucide-react';
import ConditionBadge from '../../components/ConditionBadge';
import { format, differenceInMonths } from 'date-fns';
import toast from 'react-hot-toast';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newInterval, setNewInterval] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

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

  async function flagForInspection() {
    if (!item) return;
    setActionSaving(true);
    try {
      await updateDoc(doc(db, 'items', item.id), {
        condition: 'needs_investigating',
        conditionFlagNote: 'Inspection interval exceeded — pending review.',
        updatedAt: serverTimestamp(),
      });
      setItem((p) => p ? { ...p, condition: 'needs_investigating', conditionFlagNote: 'Inspection interval exceeded — pending review.' } : p);
      toast.success('Item flagged for inspection');
    } catch {
      toast.error('Failed to flag item');
    } finally {
      setActionSaving(false);
    }
  }

  async function passInspection() {
    if (!item || !newInterval) return;
    const months = Number(newInterval);
    if (!months || months < 1) { toast.error('Enter a valid number of months'); return; }
    setActionSaving(true);
    try {
      const resetDate = Timestamp.fromDate(new Date());
      await updateDoc(doc(db, 'items', item.id), {
        condition: 'good',
        conditionFlagNote: '',
        lifespanResetDate: resetDate,
        expectedLifespanMonths: months,
        updatedAt: serverTimestamp(),
      });
      setItem((p) => p ? { ...p, condition: 'good', conditionFlagNote: '', lifespanResetDate: resetDate, expectedLifespanMonths: months } : p);
      setShowResetModal(false);
      setNewInterval('');
      toast.success('Inspection logged — meter reset');
    } catch {
      toast.error('Failed to reset lifespan');
    } finally {
      setActionSaving(false);
    }
  }

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
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p>
                    This item is marked as{' '}
                    <strong>
                      {item.condition === 'needs_attention' ? 'Needs attention' :
                       item.condition === 'needs_investigating' ? 'Needs investigating' :
                       'Damaged'}
                    </strong>{' '}and is blocked from booking.
                  </p>
                  {item.conditionFlagNote && (
                    <p className="mt-1 text-xs text-amber-700">{item.conditionFlagNote}</p>
                  )}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoRow icon={Hash} label="Category" value={item.category} />
              {item.assetNumber && <InfoRow icon={Hash} label="Asset No." value={item.assetNumber} />}
              {item.serialNumber && <InfoRow icon={Hash} label="Serial No." value={item.serialNumber} />}
              {item.location && <InfoRow icon={MapPin} label="Location" value={item.location} />}
              {item.purchaseDate && (
                <InfoRow icon={CalendarDays} label="Purchased" value={formatTS(item.purchaseDate)} />
              )}
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

          {/* Lifespan meter */}
          {item.purchaseDate && item.expectedLifespanMonths && (() => {
            const startDate = (item.lifespanResetDate ?? item.purchaseDate)!.toDate();
            const ageMonths = Math.max(0, differenceInMonths(new Date(), startDate));
            const pct = Math.round((ageMonths / item.expectedLifespanMonths) * 100);
            const isDue = pct >= 100;
            const isAwaitingReset = isDue && item.condition === 'needs_investigating';
            const barColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500';

            const fmtMonths = (m: number) => {
              const y = Math.floor(m / 12); const mo = m % 12;
              if (y > 0 && mo > 0) return `${y} yr${y > 1 ? 's' : ''} ${mo} month${mo > 1 ? 's' : ''}`;
              if (y > 0) return `${y} yr${y > 1 ? 's' : ''}`;
              return `${mo} month${mo !== 1 ? 's' : ''}`;
            };

            return (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Gauge size={15} /> Lifespan
                  </h2>
                  {isDue && !isAwaitingReset && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Inspection Due</span>
                  )}
                  {isAwaitingReset && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Awaiting Inspection</span>
                  )}
                </div>

                <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-3 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{fmtMonths(ageMonths)} old</span>
                  <span>{Math.min(pct, 999)}% of {fmtMonths(item.expectedLifespanMonths)} interval</span>
                </div>

                {isDue && !isAwaitingReset && (
                  <button
                    onClick={flagForInspection}
                    disabled={actionSaving}
                    className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    Flag for Inspection
                  </button>
                )}

                {isAwaitingReset && !showResetModal && (
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    ✓ Pass Inspection &amp; Reset
                  </button>
                )}

                {isAwaitingReset && showResetModal && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                    <p className="text-xs font-medium text-gray-700">How many months until the next inspection?</p>
                    <input
                      type="number"
                      min="1"
                      value={newInterval}
                      onChange={(e) => setNewInterval(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. 12"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowResetModal(false); setNewInterval(''); }}
                        className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={passInspection}
                        disabled={actionSaving || !newInterval}
                        className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionSaving ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Checkout history */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={15} /> Checkout History
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">No checkout history yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {history.map((c) => (
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
