import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Reservation, Item, Kit } from '../../types';
import { Link } from 'react-router-dom';
import { Plus, Calendar, List, X } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { format, subDays } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { writeAuditLog } from '../../lib/auditLog';
import { useItems } from '../../store/items';
import { fetchMondayFilmingDates, type MondayFilmingEvent } from '../../lib/monday';

export default function ReservationsList() {
  const { appUser, currentUser } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<Reservation['status'] | 'all'>('all');
  const { byId: items } = useItems();
  const [kits, setKits] = useState<Record<string, Kit>>({});
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [dateRange, setDateRange] = useState<30 | 90>(30);
  const [showMonday, setShowMonday] = useState(false);
  const [mondayEvents, setMondayEvents] = useState<MondayFilmingEvent[]>([]);
  const [mondayLoading, setMondayLoading] = useState(false);
  const [orgMondayKey, setOrgMondayKey] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser?.orgId) return;
    return onSnapshot(
      query(collection(db, 'reservations'), where('orgId', '==', appUser.orgId), orderBy('startDate', 'desc')),
      (s) => setReservations(s.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))),
      (err) => console.error('Reservations query failed:', err)
    );
  }, [appUser?.orgId]);

  useEffect(() => {
    if (!appUser?.orgId) return;
    getDocs(query(collection(db, 'kits'), where('orgId', '==', appUser.orgId))).then((kitSnap) => {
      const kMap: Record<string, Kit> = {};
      kitSnap.docs.forEach((d) => { kMap[d.id] = { id: d.id, ...d.data() } as Kit; });
      setKits(kMap);
    });
  }, [appUser?.orgId]);

  async function handleApprove(id: string) {
    try {
      await updateDoc(doc(db, 'reservations', id), {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });
      const res = reservations.find((r) => r.id === id);
      await writeAuditLog({
        orgId: appUser!.orgId,
        action: 'approve_reservation',
        performedBy: currentUser!.uid,
        performedByName: appUser!.displayName,
        targetType: 'reservation',
        targetId: id,
        targetName: `${res?.userName ?? 'Unknown'}'s reservation`,
      });
      toast.success('Reservation approved');
    } catch {
      toast.error('Failed to approve');
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await updateDoc(doc(db, 'reservations', id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      const res = reservations.find((r) => r.id === id);
      await writeAuditLog({
        orgId: appUser!.orgId,
        action: 'cancel_reservation',
        performedBy: currentUser!.uid,
        performedByName: appUser!.displayName,
        targetType: 'reservation',
        targetId: id,
        targetName: `${res?.userName ?? 'Unknown'}'s reservation`,
      });
      toast.success('Reservation cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  }

  useEffect(() => {
    if (!appUser?.orgId || appUser.role !== 'admin') return;
    getDoc(doc(db, 'organizations', appUser.orgId, 'private', 'integrations')).then((snap) => {
      if (snap.exists()) setOrgMondayKey(snap.data().mondayApiKey ?? null);
    }).catch(() => {});
  }, [appUser?.orgId, appUser?.role]);

  useEffect(() => {
    if (!showMonday || mondayEvents.length > 0) return;
    setMondayLoading(true);
    fetchMondayFilmingDates(orgMondayKey ?? undefined)
      .then(setMondayEvents)
      .catch(() => toast.error('Failed to load Monday.com bookings'))
      .finally(() => setMondayLoading(false));
  }, [showMonday, orgMondayKey]);

  const cutoff = subDays(new Date(), dateRange);
  const activeStatuses: Reservation['status'][] = ['pending', 'approved', 'checked_out'];
  const visibleReservations = reservations.filter((r) => {
    if (activeStatuses.includes(r.status)) return true;
    try { return r.endDate.toDate() >= cutoff; } catch { return true; }
  });
  const filtered =
    filter === 'all' ? visibleReservations : visibleReservations.filter((r) => r.status === filter);

  const geartrackEvents = reservations
    .filter((r) => r.status !== 'cancelled' && r.status !== 'completed')
    .map((r) => ({
      id: r.id,
      title: `${r.userName} — ${bookingLabel(r, items, kits)}`,
      start: r.startDate.toDate(),
      end: r.endDate.toDate(),
      backgroundColor: statusColor(r.status),
      borderColor: statusColor(r.status),
      extendedProps: { source: 'geartrack', status: r.status },
    }));

  const mondayCalendarEvents = showMonday
    ? mondayEvents.map((e) => ({
        id: e.id,
        title: `📽 ${e.title}`,
        start: e.date,
        allDay: true,
        backgroundColor: '#7c3aed',
        borderColor: '#6d28d9',
        extendedProps: { source: 'monday' },
      }))
    : [];

  const calendarEvents = [...geartrackEvents, ...mondayCalendarEvents];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
          <p className="mt-0.5 text-sm text-gray-500">{visibleReservations.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar size={13} /> Calendar
            </button>
          </div>
          <Link
            to="/reservations/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            New Reservation
          </Link>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => setShowMonday((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showMonday
                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
              {mondayLoading ? 'Loading…' : 'Monday.com filming dates'}
            </button>
          </div>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,listWeek',
            }}
            events={calendarEvents}
            height={600}
            eventClick={(info) => {
              const res = reservations.find((r) => r.id === info.event.id);
              if (res) setSelectedReservation(res);
            }}
          />
        </div>
      ) : (
        <>
          {/* Status filter + date range toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'checked_out', 'completed', 'cancelled'] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      filter === s
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {s === 'all' ? 'All' : s.replace('_', ' ')}
                  </button>
                )
              )}
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
                <p className="text-sm text-gray-400">No reservations found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-5 py-3 text-left font-medium">User</th>
                    <th className="px-5 py-3 text-left font-medium">Items</th>
                    <th className="px-5 py-3 text-left font-medium">Start</th>
                    <th className="px-5 py-3 text-left font-medium">End</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    {appUser?.role !== 'user' && (
                      <th className="px-5 py-3 text-left font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedReservation(r)}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{r.userName}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-gray-900">{bookingLabel(r, items, kits)}</p>
                        {r.itemIds.length > 2 && !r.kitId && (
                          <p className="text-xs text-gray-400">+{r.itemIds.length - 2} more</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{formatTS(r.startDate)}</td>
                      <td className="px-5 py-3 text-gray-600">{formatTS(r.endDate)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={r.status} type="reservation" />
                      </td>
                      {appUser?.role !== 'user' && (
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            {r.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                              >
                                Approve
                              </button>
                            )}
                            {['pending', 'approved'].includes(r.status) && (
                              <button
                                onClick={() => handleCancel(r.id)}
                                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                              >
                                Cancel
                              </button>
                            )}
                            {r.status === 'approved' && (
                              <Link
                                to={`/checkouts?reservationId=${r.id}`}
                                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                              >
                                Check Out
                              </Link>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedReservation(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Reservation Details</h2>
              <button onClick={() => setSelectedReservation(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedReservation.userName}</p>
                  <p className="text-xs text-gray-500">{selectedReservation.userEmail}</p>
                </div>
                <StatusBadge status={selectedReservation.status} type="reservation" />
              </div>
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <p className="text-xs font-medium text-gray-500 mb-1">Period</p>
                <p className="text-gray-800">{formatTS(selectedReservation.startDate)} → {formatTS(selectedReservation.endDate)}</p>
              </div>
              <div>
                {selectedReservation.kitId && kits[selectedReservation.kitId] && (
                  <p className="mb-2 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5">
                    Kit: {kits[selectedReservation.kitId].name}
                  </p>
                )}
                <p className="text-xs font-medium text-gray-500 mb-2">Reserved Items ({selectedReservation.itemIds.length})</p>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {selectedReservation.itemIds.map((id) => (
                    <li key={id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">{items[id]?.name ?? id}</span>
                      <span className="text-xs text-gray-400">{items[id]?.category ?? ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedReservation.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedReservation.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function bookingLabel(r: Reservation, items: Record<string, Item>, kits: Record<string, Kit>): string {
  if (r.kitId && kits[r.kitId]) return kits[r.kitId].name;
  const names = r.itemIds.slice(0, 2).map((id) => items[id]?.name ?? 'Unknown item');
  return names.join(', ') || `${r.itemIds.length} items`;
}

function statusColor(s: Reservation['status']) {
  const map: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#10b981',
    checked_out: '#3b82f6',
    completed: '#6b7280',
    cancelled: '#ef4444',
  };
  return map[s] ?? '#6b7280';
}

function formatTS(ts: Timestamp) {
  try {
    return format(ts.toDate(), 'MMM d, yyyy h:mm a');
  } catch {
    return '—';
  }
}
