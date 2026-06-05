import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Reservation } from '../../types';
import { Link } from 'react-router-dom';
import { Plus, Calendar, List } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function ReservationsList() {
  const { appUser } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<Reservation['status'] | 'all'>('all');

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'reservations'), orderBy('startDate', 'desc')),
      (s) => setReservations(s.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
    );
  }, []);

  async function handleApprove(id: string) {
    try {
      await updateDoc(doc(db, 'reservations', id), {
        status: 'approved',
        updatedAt: serverTimestamp(),
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
      toast.success('Reservation cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  }

  const filtered =
    filter === 'all' ? reservations : reservations.filter((r) => r.status === filter);

  const calendarEvents = reservations.map((r) => ({
    id: r.id,
    title: `${r.userName} (${r.itemIds.length} items)`,
    start: r.startDate.toDate(),
    end: r.endDate.toDate(),
    backgroundColor: statusColor(r.status),
    borderColor: statusColor(r.status),
    extendedProps: { status: r.status },
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
          <p className="mt-0.5 text-sm text-gray-500">{reservations.length} total</p>
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
              const id = info.event.id;
              const res = reservations.find((r) => r.id === id);
              if (res) alert(`${res.userName}\n${formatTS(res.startDate)} → ${formatTS(res.endDate)}\nStatus: ${res.status}`);
            }}
          />
        </div>
      ) : (
        <>
          {/* Status filter */}
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
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{r.userName}</p>
                        <p className="text-xs text-gray-500">{r.userEmail}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{r.itemIds.length} item{r.itemIds.length !== 1 ? 's' : ''}</td>
                      <td className="px-5 py-3 text-gray-600">{formatTS(r.startDate)}</td>
                      <td className="px-5 py-3 text-gray-600">{formatTS(r.endDate)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={r.status} type="reservation" />
                      </td>
                      {appUser?.role !== 'user' && (
                        <td className="px-5 py-3">
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
                                to={`/checkouts/new?reservationId=${r.id}`}
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
    </div>
  );
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
