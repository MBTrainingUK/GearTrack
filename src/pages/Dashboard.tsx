import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Item, Checkout, Reservation } from '../types';
import { Link } from 'react-router-dom';
import {
  Package,
  ArrowLeftRight,
  AlertTriangle,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format, subDays } from 'date-fns';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const { appUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [recentCheckouts, setRecentCheckouts] = useState<Checkout[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [chartData, setChartData] = useState<{ day: string; checkouts: number }[]>([]);
  const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null);

  useEffect(() => {
    const sevenDaysAgo = Timestamp.fromDate(subDays(new Date(), 7));
    const unsubs = [
      onSnapshot(collection(db, 'items'), (s) =>
        setItems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Item)))
      ),
      onSnapshot(
        query(collection(db, 'checkouts'), where('status', 'in', ['active', 'overdue'])),
        (s) => setCheckouts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)))
      ),
      onSnapshot(
        query(collection(db, 'checkouts'), where('checkedOutAt', '>=', sevenDaysAgo)),
        (s) => setRecentCheckouts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout)))
      ),
      onSnapshot(
        query(collection(db, 'reservations'), where('status', 'in', ['pending', 'approved'])),
        (s) => {
          const sorted = s.docs
            .map((d) => ({ id: d.id, ...d.data() } as Reservation))
            .sort((a, b) => (a.startDate?.toMillis() ?? 0) - (b.startDate?.toMillis() ?? 0));
          setReservations(sorted);
        }
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Build last-7-days chart from real checkout data
  useEffect(() => {
    const days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
    const data = days.map((d) => {
      const label = format(d, 'MMM d');
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const count = checkouts.filter((c) => {
        try {
          const t = c.checkedOutAt.toDate();
          return t >= dayStart && t <= dayEnd;
        } catch { return false; }
      }).length;
      return { day: label, checkouts: count };
    });
    setChartData(data);
  }, [recentCheckouts]);

  const available = items.filter((i) => i.status === 'available').length;
  const checkedOut = items.filter((i) => i.status === 'checked_out').length;
  const overdue = checkouts.filter((c) => c.status === 'overdue').length;
  const upcomingReservations = reservations.slice(0, 5);

  const stats = [
    {
      label: 'Total Items',
      value: items.length,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/items',
    },
    {
      label: 'Available',
      value: available,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/items',
    },
    {
      label: 'Checked Out',
      value: checkedOut,
      icon: ArrowLeftRight,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      href: '/checkouts',
    },
    {
      label: 'Overdue',
      value: overdue,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      href: '/checkouts',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {greeting()}, {appUser?.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">Here's what's happening with your equipment today.</p>
      </div>

      {/* Overdue alert */}
      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{overdue} item{overdue > 1 ? 's' : ''}</span> {overdue > 1 ? 'are' : 'is'} overdue.{' '}
            <Link to="/checkouts" className="underline hover:no-underline">Review now →</Link>
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link
            key={label}
            to={href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`mb-3 inline-flex rounded-lg ${bg} p-2`}>
              <Icon size={18} className={color} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="mt-0.5 text-sm text-gray-500">{label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Activity chart */}
        <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Checkouts — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="checkouts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming reservations */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Reservations</h2>
            <Link to="/reservations" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {upcomingReservations.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-gray-400">No upcoming reservations</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingReservations.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.userName}</p>
                    <p className="text-xs text-gray-500">
                      {formatTS(r.startDate)} → {formatTS(r.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} type="reservation" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Active checkouts table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Active Checkouts</h2>
          <Link to="/checkouts" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {checkouts.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <p className="text-sm text-gray-400">No active checkouts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">User</th>
                  <th className="px-5 py-3 text-left font-medium">Items</th>
                  <th className="px-5 py-3 text-left font-medium">Due</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {checkouts.slice(0, 8).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCheckout(c)}>
                    <td className="px-5 py-3 font-medium text-gray-900">{c.userName}</td>
                    <td className="px-5 py-3 text-gray-600">{c.itemIds.length} item{c.itemIds.length > 1 ? 's' : ''}</td>
                    <td className="px-5 py-3 text-gray-600">{formatTS(c.dueDate)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} type="checkout" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedCheckout(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">{selectedCheckout.userName}</h2>
                <p className="text-xs text-gray-500">{selectedCheckout.userEmail}</p>
              </div>
              <button onClick={() => setSelectedCheckout(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">Checked Out</p>
                  <p className="font-medium text-gray-900">{formatTS(selectedCheckout.checkedOutAt)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">Due Back</p>
                  <p className="font-medium text-gray-900">{formatTS(selectedCheckout.dueDate)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Items ({selectedCheckout.itemIds.length})</p>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {selectedCheckout.itemIds.map((id) => {
                    const item = items.find((i) => i.id === id);
                    return (
                      <li key={id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <span className="font-medium text-gray-900">{item?.name ?? id}</span>
                        <span className="text-xs text-gray-400">{item?.category ?? ''}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {selectedCheckout.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedCheckout.notes}</p>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 px-6 py-3">
              <Link to="/checkouts" onClick={() => setSelectedCheckout(null)} className="text-sm text-blue-600 hover:underline">View in Checkouts →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatTS(ts: Timestamp) {
  try {
    return format(ts.toDate(), 'MMM d, h:mm a');
  } catch {
    return '—';
  }
}
