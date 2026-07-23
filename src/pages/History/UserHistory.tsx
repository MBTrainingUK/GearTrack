import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Checkout, Reservation } from '../../types';
import { useAuth } from '../../context/useAuth';
import { useItems } from '../../store/items';
import StatusBadge from '../../components/StatusBadge';
import { format, subDays } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { History, RotateCcw, LogOut, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserHistory() {
  const { currentUser, appUser } = useAuth();
  const navigate = useNavigate();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const { byId: items } = useItems();
  const [tab, setTab] = useState<'checkouts' | 'reservations'>('checkouts');
  const [dateRange, setDateRange] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !appUser?.orgId) return;
    Promise.all([
      getDocs(
        query(
          collection(db, 'checkouts'),
          where('orgId', '==', appUser.orgId),
          where('userId', '==', currentUser.uid)
        )
      ),
      getDocs(
        query(
          collection(db, 'reservations'),
          where('orgId', '==', appUser.orgId),
          where('userId', '==', currentUser.uid)
        )
      ),
    ]).then(([cSnap, rSnap]) => {
      setCheckouts(
        cSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Checkout))
          .sort((a, b) => (b.checkedOutAt?.toMillis() ?? 0) - (a.checkedOutAt?.toMillis() ?? 0))
      );
      setReservations(
        rSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Reservation))
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentUser, appUser?.orgId]);

  const checkoutByReservation = Object.fromEntries(
    checkouts.filter((c) => c.reservationId && c.status === 'active').map((c) => [c.reservationId, c.id])
  );

  const cutoff = subDays(new Date(), dateRange);
  const filteredCheckouts = checkouts.filter((c) => {
    try { return c.checkedOutAt.toDate() >= cutoff; } catch { return true; }
  });
  const filteredReservations = reservations.filter((r) => {
    try { return r.startDate.toDate() >= cutoff; } catch { return true; }
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <History size={22} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">My History</h1>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['checkouts', 'reservations'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t} (
            {t === 'checkouts' ? filteredCheckouts.length : filteredReservations.length})
          </button>
        ))}
      </div>

      {tab === 'checkouts' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {filteredCheckouts.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">No checkout history</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">Items</th>
                  <th className="px-5 py-3 text-left font-medium">Checked Out</th>
                  <th className="px-5 py-3 text-left font-medium">Due</th>
                  <th className="px-5 py-3 text-left font-medium">Returned</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Condition</th>
                  <th className="px-5 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCheckouts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        {c.itemIds.slice(0, 2).map((id) => (
                          <p key={id} className="text-xs text-gray-700">{items[id]?.name ?? id}</p>
                        ))}
                        {c.itemIds.length > 2 && (
                          <p className="text-xs text-gray-400">+{c.itemIds.length - 2} more</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{formatTS(c.checkedOutAt)}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{formatTS(c.dueDate)}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {c.returnedAt ? formatTS(c.returnedAt) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} type="checkout" />
                    </td>
                    <td className="px-5 py-3 text-xs capitalize text-gray-600">
                      {c.returnCondition?.condition ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/reservations/new?itemIds=${c.itemIds.join(',')}`)}
                        title="Reserve the same items again"
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      >
                        <RotateCcw size={11} />
                        Repeat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'reservations' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {filteredReservations.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">No reservation history</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">Items</th>
                  <th className="px-5 py-3 text-left font-medium">Start</th>
                  <th className="px-5 py-3 text-left font-medium">End</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                  <th className="px-5 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredReservations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-xs text-gray-700">
                      {r.itemIds.length} item{r.itemIds.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{formatTS(r.startDate)}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{formatTS(r.endDate)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} type="reservation" />
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {r.notes ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {r.status === 'approved' && (
                        <button
                          onClick={() => navigate(`/checkouts?reservationId=${r.id}`)}
                          title="Check out this reservation"
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                          <LogOut size={11} />
                          Check Out
                        </button>
                      )}
                      {r.status === 'checked_out' && checkoutByReservation[r.id] && (
                        <button
                          onClick={() => navigate(`/checkouts?returnId=${checkoutByReservation[r.id]}`)}
                          title="Return these items"
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <LogIn size={11} />
                          Check In
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function formatTS(ts: Timestamp | undefined) {
  if (!ts) return '—';
  try {
    return format(ts.toDate(), 'MMM d, yyyy h:mm a');
  } catch {
    return '—';
  }
}
