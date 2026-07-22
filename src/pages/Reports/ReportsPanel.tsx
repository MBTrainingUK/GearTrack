import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Checkout, Reservation } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart2 } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getLifespanStatus, formatMonths, type LifespanStatus } from '../../lib/items';

interface ItemStat {
  id: string;
  name: string;
  category: string;
  purchaseDate?: Timestamp;
  purchasePrice?: number;
  status: string;
  checkoutCount: number;
  totalDaysOut: number;
  conditionCounts: Record<string, number>;
}

interface UserStat {
  userId: string;
  userName: string;
  checkoutCount: number;
  itemsCheckedOut: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ReportsPanel() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [itemStats, setItemStats] = useState<ItemStat[]>([]);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [categoryStats, setCategoryStats] = useState<{ name: string; value: number }[]>([]);
  const [conditionStats, setConditionStats] = useState<{ name: string; value: number }[]>([]);
  const [avgDuration, setAvgDuration] = useState(0);
  const [overdueRate, setOverdueRate] = useState(0);
  const [neverUsed, setNeverUsed] = useState<Item[]>([]);
  const [tab, setTab] = useState<'overview' | 'items' | 'inspections' | 'users' | 'reservations' | 'financials'>('overview');
  const [inspectionRows, setInspectionRows] = useState<{ item: Item; status: LifespanStatus }[]>([]);
  const [totalReservations, setTotalReservations] = useState(0);
  const [reservationsByStatus, setReservationsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [cancellationRate, setCancellationRate] = useState(0);
  const [approvalRate, setApprovalRate] = useState(0);
  const [avgLeadTime, setAvgLeadTime] = useState(0);
  const [topReservedItems, setTopReservedItems] = useState<{ name: string; count: number }[]>([]);

  // Financial state
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [valueCurrentlyOut, setValueCurrentlyOut] = useState(0);
  const [avgItemValue, setAvgItemValue] = useState(0);
  const [avgActiveCheckoutValue, setAvgActiveCheckoutValue] = useState(0);
  const [itemsMissingPriceCount, setItemsMissingPriceCount] = useState(0);
  const [valueByCat, setValueByCat] = useState<{ name: string; value: number }[]>([]);

  type FinSort = 'name' | 'category' | 'price' | 'age' | 'checkouts' | 'daysOut' | 'costPerCheckout' | 'utilisation';
  const [finSort, setFinSort] = useState<FinSort>('costPerCheckout');
  const [finAsc, setFinAsc] = useState(true);

  function toggleFinSort(col: FinSort) {
    if (finSort === col) setFinAsc((a) => !a);
    else { setFinSort(col); setFinAsc(true); }
  }

  type InspSort = 'name' | 'category' | 'status' | 'interval' | 'remaining';
  const [inspSort, setInspSort] = useState<InspSort>('remaining');
  const [inspAsc, setInspAsc] = useState(true);

  function toggleInspSort(col: InspSort) {
    if (inspSort === col) setInspAsc((a) => !a);
    else { setInspSort(col); setInspAsc(true); }
  }

  useEffect(() => {
    if (!appUser?.orgId) return;
    const orgId = appUser.orgId;
    Promise.all([
      getDocs(query(collection(db, 'items'), where('orgId', '==', orgId))),
      getDocs(query(collection(db, 'checkouts'), where('orgId', '==', orgId))),
      getDocs(query(collection(db, 'reservations'), where('orgId', '==', orgId))),
    ]).then(([itemsSnap, checkoutsSnap, reservationsSnap]) => {
      const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      const checkouts = checkoutsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout));

      // --- Inspection / lifespan stats ---
      setInspectionRows(
        items
          .map((item) => {
            const status = getLifespanStatus(item);
            return status ? { item, status } : null;
          })
          .filter((r): r is { item: Item; status: LifespanStatus } => r !== null)
      );

      // --- Item stats ---
      const iMap: Record<string, ItemStat> = {};
      items.forEach((i) => {
        iMap[i.id] = { id: i.id, name: i.name, category: i.category, purchaseDate: i.purchaseDate, purchasePrice: i.purchasePrice, status: i.status, checkoutCount: 0, totalDaysOut: 0, conditionCounts: {} };
      });

      checkouts.forEach((c) => {
        c.itemIds.forEach((itemId) => {
          if (!iMap[itemId]) return;
          iMap[itemId].checkoutCount++;
          // Duration — use returnedAt for completed checkouts, now for still-active ones
          if (c.checkedOutAt) {
            const endMs = c.returnedAt ? c.returnedAt.toMillis() : Date.now();
            const days = (endMs - c.checkedOutAt.toMillis()) / (1000 * 60 * 60 * 24);
            iMap[itemId].totalDaysOut += days;
          }
          // Return condition
          if (c.returnCondition?.condition) {
            const cond = c.returnCondition.condition;
            iMap[itemId].conditionCounts[cond] = (iMap[itemId].conditionCounts[cond] ?? 0) + 1;
          }
        });
      });

      const sortedItems = Object.values(iMap).sort((a, b) => b.checkoutCount - a.checkoutCount);
      setItemStats(sortedItems);
      setNeverUsed(items.filter((i) => iMap[i.id].checkoutCount === 0));

      // --- Financial stats ---
      const priced = items.filter((i) => i.purchasePrice != null);
      const totInvValue = items.reduce((s, i) => s + (i.purchasePrice ?? 0), 0);
      const valOut = items.filter((i) => i.status === 'checked_out').reduce((s, i) => s + (i.purchasePrice ?? 0), 0);
      const avgVal = priced.length > 0 ? priced.reduce((s, i) => s + (i.purchasePrice ?? 0), 0) / priced.length : 0;
      const activeChks = checkouts.filter((c) => c.status === 'active');
      const avgActChkVal = activeChks.length > 0
        ? activeChks.reduce((s, c) => s + c.itemIds.reduce((sum, id) => sum + (iMap[id]?.purchasePrice ?? 0), 0), 0) / activeChks.length
        : 0;
      const catValueMap: Record<string, number> = {};
      items.forEach((i) => { if (i.purchasePrice) catValueMap[i.category] = (catValueMap[i.category] ?? 0) + i.purchasePrice; });
      setTotalInventoryValue(totInvValue);
      setValueCurrentlyOut(valOut);
      setAvgItemValue(avgVal);
      setAvgActiveCheckoutValue(avgActChkVal);
      setItemsMissingPriceCount(items.length - priced.length);
      setValueByCat(Object.entries(catValueMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // --- User stats ---
      const uMap: Record<string, UserStat> = {};
      checkouts.forEach((c) => {
        if (!uMap[c.userId]) {
          uMap[c.userId] = { userId: c.userId, userName: c.userName, checkoutCount: 0, itemsCheckedOut: 0 };
        }
        uMap[c.userId].checkoutCount++;
        uMap[c.userId].itemsCheckedOut += c.itemIds.length;
      });
      setUserStats(Object.values(uMap).sort((a, b) => b.checkoutCount - a.checkoutCount));

      // --- Category breakdown ---
      const catMap: Record<string, number> = {};
      checkouts.forEach((c) => {
        c.itemIds.forEach((itemId) => {
          const cat = iMap[itemId]?.category ?? 'Unknown';
          catMap[cat] = (catMap[cat] ?? 0) + 1;
        });
      });
      setCategoryStats(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      // --- Return condition breakdown ---
      const condMap: Record<string, number> = {};
      checkouts.forEach((c) => {
        if (c.returnCondition?.condition) {
          const cond = c.returnCondition.condition;
          condMap[cond] = (condMap[cond] ?? 0) + 1;
        }
      });
      const condLabels: Record<string, string> = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', damaged: 'Damaged' };
      setConditionStats(Object.entries(condMap).map(([k, v]) => ({ name: condLabels[k] ?? k, value: v })));

      // --- Average checkout duration ---
      const durations = checkouts
        .filter((c) => c.checkedOutAt && c.returnedAt)
        .map((c) => (c.returnedAt!.toMillis() - c.checkedOutAt.toMillis()) / (1000 * 60 * 60 * 24));
      setAvgDuration(durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0);

      // --- Overdue rate --- only count as late if returned on a later calendar day than due date
      const returned = checkouts.filter((c) => c.status === 'returned').length;
      const overdueCount = checkouts.filter((c) =>
        c.status === 'returned' &&
        c.returnedAt &&
        c.dueDate &&
        startOfDay(c.returnedAt.toDate()) > startOfDay(c.dueDate.toDate())
      ).length;
      setOverdueRate(returned > 0 ? (overdueCount / returned) * 100 : 0);

      // --- Reservation stats ---
      const reservations = reservationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation));
      setTotalReservations(reservations.length);

      const statusMap: Record<string, number> = {};
      reservations.forEach((r) => { statusMap[r.status] = (statusMap[r.status] ?? 0) + 1; });
      const statusLabels: Record<string, string> = { pending: 'Pending', approved: 'Approved', checked_out: 'Checked Out', completed: 'Completed', cancelled: 'Cancelled' };
      setReservationsByStatus(Object.entries(statusMap).map(([k, v]) => ({ name: statusLabels[k] ?? k, value: v })));

      const cancelled = statusMap['cancelled'] ?? 0;
      const approved = (statusMap['approved'] ?? 0) + (statusMap['checked_out'] ?? 0) + (statusMap['completed'] ?? 0);
      setCancellationRate(reservations.length > 0 ? (cancelled / reservations.length) * 100 : 0);
      setApprovalRate(reservations.length > 0 ? (approved / reservations.length) * 100 : 0);

      const leadTimes = reservations
        .filter((r) => r.createdAt && r.startDate)
        .map((r) => (r.startDate.toMillis() - r.createdAt.toMillis()) / (1000 * 60 * 60 * 24));
      setAvgLeadTime(leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0);

      const itemFreq: Record<string, number> = {};
      reservations.forEach((r) => { r.itemIds.forEach((id) => { itemFreq[id] = (itemFreq[id] ?? 0) + 1; }); });
      setTopReservedItems(
        Object.entries(itemFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id, count]) => ({ name: iMap[id]?.name ?? 'Unknown', count }))
      );

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [appUser?.orgId]);

  // Guard: Reports is admin-only (checked after hooks to keep hook order stable)
  if (appUser && appUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const totalCheckouts = itemStats.reduce((s, i) => s + i.checkoutCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 size={22} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Usage analytics across all equipment</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['overview', 'items', 'inspections', 'users', 'reservations', 'financials'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Checkouts" value={totalCheckouts} />
            <StatCard label="Avg. Duration" value={`${avgDuration.toFixed(1)} days`} />
            <StatCard label="Late Return Rate" value={`${overdueRate.toFixed(0)}%`} color={overdueRate > 20 ? 'text-red-600' : 'text-emerald-600'} />
            <StatCard label="Unused Items" value={neverUsed.length} color={neverUsed.length > 0 ? 'text-amber-600' : 'text-emerald-600'} />
            <StatCard label="Total Reservations" value={totalReservations} />
            <StatCard label="Approval Rate" value={`${approvalRate.toFixed(0)}%`} color="text-emerald-600" />
            <StatCard label="Cancellation Rate" value={`${cancellationRate.toFixed(0)}%`} color={cancellationRate > 30 ? 'text-red-600' : 'text-emerald-600'} />
            <StatCard label="Avg. Lead Time" value={`${avgLeadTime.toFixed(1)} days`} />
          </div>

          {/* Category chart + Condition pie */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Checkouts by Category</h2>
              {categoryStats.length === 0 ? (
                <p className="text-sm text-gray-400">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryStats} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Checkouts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Return Condition Breakdown</h2>
              {conditionStats.length === 0 ? (
                <p className="text-sm text-gray-400">No returned items yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={conditionStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={false} labelLine={false} fontSize={11}>
                      {conditionStats.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Never used */}
          {neverUsed.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="mb-3 text-sm font-semibold text-amber-900">Unused Items ({neverUsed.length})</h2>
              <p className="mb-3 text-xs text-amber-700">These items have never been checked out.</p>
              <div className="flex flex-wrap gap-2">
                {neverUsed.map((i) => (
                  <span key={i.id} className="rounded-full bg-white border border-amber-200 px-3 py-1 text-xs text-amber-800">
                    {i.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ITEMS TAB ── */}
      {tab === 'items' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {itemStats.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">No data yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">Item</th>
                  <th className="px-5 py-3 text-left font-medium">Category</th>
                  <th className="px-5 py-3 text-left font-medium">Purchased</th>
                  <th className="px-5 py-3 text-left font-medium">Times Booked</th>
                  <th className="px-5 py-3 text-left font-medium">Avg. Days Out</th>
                  <th className="px-5 py-3 text-left font-medium">Top Return Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {itemStats.map((i) => {
                  const topCond = Object.entries(i.conditionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                  const avgDays = i.checkoutCount > 0 && i.totalDaysOut > 0
                    ? (i.totalDaysOut / i.checkoutCount).toFixed(1)
                    : '—';
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{i.name}</td>
                      <td className="px-5 py-3 text-gray-500">{i.category}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {i.purchaseDate ? format(i.purchaseDate.toDate(), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-blue-100 flex-1 max-w-[80px]">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${Math.min(100, (i.checkoutCount / (itemStats[0]?.checkoutCount || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-900 tabular-nums">{i.checkoutCount}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{avgDays}</td>
                      <td className="px-5 py-3 capitalize text-gray-600">{topCond ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── INSPECTIONS TAB ── */}
      {tab === 'inspections' && (() => {
        const dueCount = inspectionRows.filter((r) => r.status.isDue && !r.status.isAwaitingReset).length;
        const awaitingCount = inspectionRows.filter((r) => r.status.isAwaitingReset).length;
        const dueSoonCount = inspectionRows.filter((r) => !r.status.isDue && r.status.pct >= 80).length;

        function bucket(status: LifespanStatus) {
          if (status.isDue && !status.isAwaitingReset) return { label: 'Inspection Due', rank: 0, className: 'bg-red-100 text-red-700' };
          if (status.isAwaitingReset) return { label: 'Awaiting Inspection', rank: 1, className: 'bg-amber-100 text-amber-700' };
          if (status.pct >= 80) return { label: 'Due Soon', rank: 2, className: 'bg-yellow-100 text-yellow-700' };
          return { label: 'OK', rank: 3, className: 'bg-emerald-100 text-emerald-700' };
        }

        const sorted = [...inspectionRows].sort((a, b) => {
          if (inspSort === 'name') { const r = a.item.name.localeCompare(b.item.name); return inspAsc ? r : -r; }
          if (inspSort === 'category') { const r = a.item.category.localeCompare(b.item.category); return inspAsc ? r : -r; }
          if (inspSort === 'status') { const r = bucket(a.status).rank - bucket(b.status).rank; return inspAsc ? r : -r; }
          let av: number, bv: number;
          if (inspSort === 'interval') { av = a.item.expectedLifespanMonths ?? 0; bv = b.item.expectedLifespanMonths ?? 0; }
          else { av = a.status.monthsRemaining; bv = b.status.monthsRemaining; }
          return inspAsc ? av - bv : bv - av;
        });

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Inspection Due" value={dueCount} color={dueCount > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <StatCard label="Awaiting Inspection" value={awaitingCount} color={awaitingCount > 0 ? 'text-amber-600' : 'text-emerald-600'} />
              <StatCard label="Due Soon" value={dueSoonCount} color={dueSoonCount > 0 ? 'text-amber-600' : 'text-emerald-600'} />
              <StatCard label="Tracked Items" value={inspectionRows.length} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {inspectionRows.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-400">No items have inspection tracking configured</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      {(
                        [
                          ['name', 'Item'],
                          ['category', 'Category'],
                          ['status', 'Status'],
                          ['interval', 'Interval'],
                          ['remaining', 'Time Remaining'],
                        ] as [InspSort, string][]
                      ).map(([col, label]) => (
                        <th
                          key={col}
                          onClick={() => toggleInspSort(col)}
                          className="px-5 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
                        >
                          {label}
                          <span className="ml-1 text-gray-300">
                            {inspSort === col ? (inspAsc ? '↑' : '↓') : '↕'}
                          </span>
                        </th>
                      ))}
                      <th className="px-5 py-3 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sorted.map(({ item, status }) => {
                      const b = bucket(status);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                          <td className="px-5 py-3 text-gray-500">{item.category}</td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-500">{formatMonths(item.expectedLifespanMonths!)}</td>
                          <td className="px-5 py-3 tabular-nums text-gray-600">
                            {status.monthsRemaining >= 0
                              ? `${formatMonths(status.monthsRemaining)} left`
                              : `${formatMonths(Math.abs(status.monthsRemaining))} overdue`}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link to={`/items/${item.id}`} className="text-xs font-medium text-blue-600 hover:underline">Inspect →</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {userStats.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">No data yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">User</th>
                  <th className="px-5 py-3 text-left font-medium">Total Checkouts</th>
                  <th className="px-5 py-3 text-left font-medium">Total Items Taken</th>
                  <th className="px-5 py-3 text-left font-medium">Avg. Items / Checkout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userStats.map((u, idx) => (
                  <tr key={u.userId} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <span className="text-amber-500 text-base">🏆</span>}
                        <span className="font-medium text-gray-900">{u.userName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full bg-violet-100 flex-1 max-w-[80px]">
                          <div
                            className="h-2 rounded-full bg-violet-500"
                            style={{ width: `${Math.min(100, (u.checkoutCount / (userStats[0]?.checkoutCount || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-900 tabular-nums">{u.checkoutCount}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 tabular-nums">{u.itemsCheckedOut}</td>
                    <td className="px-5 py-3 text-gray-600">{(u.itemsCheckedOut / u.checkoutCount).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* ── FINANCIALS TAB ── */}
      {tab === 'financials' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Inventory Value" value={fmt(totalInventoryValue)} />
            <StatCard label="Value Currently Out" value={fmt(valueCurrentlyOut)} color="text-blue-600" />
            <StatCard label="Avg. Item Value" value={avgItemValue > 0 ? fmt(avgItemValue) : '—'} />
            <StatCard
              label="Avg. Value Per Checkout"
              value={avgActiveCheckoutValue > 0 ? fmt(avgActiveCheckoutValue) : '—'}
              color="text-violet-600"
            />
          </div>

          {/* Inventory value by category */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Inventory Value by Category</h2>
            {valueByCat.length === 0 ? (
              <p className="text-sm text-gray-400">No purchase price data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={valueByCat} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => `£${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" name="Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cost per checkout (ROI) table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Cost per Checkout</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Items with the lowest cost-per-checkout give the best return on investment. Utilisation shows % of time in use since purchase.
              </p>
            </div>
            {itemStats.filter((i) => i.purchasePrice != null).length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-gray-400">No purchase price data yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    {(
                      [
                        ['name', 'Item'],
                        ['category', 'Category'],
                        ['price', 'Purchase Price'],
                        ['age', 'Age'],
                        ['checkouts', 'Checkouts'],
                        ['daysOut', 'Days Out'],
                        ['costPerCheckout', 'Cost / Checkout'],
                        ['utilisation', 'Utilisation'],
                      ] as [FinSort, string][]
                    ).map(([col, label]) => (
                      <th
                        key={col}
                        onClick={() => toggleFinSort(col)}
                        className="px-5 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
                      >
                        {label}
                        <span className="ml-1 text-gray-300">
                          {finSort === col ? (finAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itemStats
                    .filter((i) => i.purchasePrice != null)
                    .map((i) => {
                      const trackingStart = new Date('2026-07-01').getTime();
                      const ageDays = i.purchaseDate ? (Date.now() - Math.max(i.purchaseDate.toMillis(), trackingStart)) / 86400000 : null;
                      const ageMonths = i.purchaseDate ? (Date.now() - i.purchaseDate.toMillis()) / (30.44 * 86400000) : null;
                      const costPerCheckout = i.purchasePrice && i.checkoutCount > 0 ? i.purchasePrice / i.checkoutCount : null;
                      const utilisationPct = ageDays && i.totalDaysOut > 0 ? Math.min(100, (i.totalDaysOut / ageDays) * 100) : 0;
                      return { ...i, ageMonths, costPerCheckout, utilisationPct };
                    })
                    .sort((a, b) => {
                      if (finSort === 'name') { const r = a.name.localeCompare(b.name); return finAsc ? r : -r; }
                      if (finSort === 'category') { const r = a.category.localeCompare(b.category); return finAsc ? r : -r; }
                      let av: number, bv: number;
                      if (finSort === 'price') { av = a.purchasePrice ?? 0; bv = b.purchasePrice ?? 0; }
                      else if (finSort === 'age') { av = a.ageMonths ?? 0; bv = b.ageMonths ?? 0; }
                      else if (finSort === 'checkouts') { av = a.checkoutCount; bv = b.checkoutCount; }
                      else if (finSort === 'daysOut') { av = a.totalDaysOut; bv = b.totalDaysOut; }
                      else if (finSort === 'utilisation') { av = a.utilisationPct; bv = b.utilisationPct; }
                      else { av = a.costPerCheckout ?? Infinity; bv = b.costPerCheckout ?? Infinity; }
                      return finAsc ? av - bv : bv - av;
                    })
                    .map((i) => (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{i.name}</td>
                        <td className="px-5 py-3 text-gray-500">{i.category}</td>
                        <td className="px-5 py-3 tabular-nums text-gray-900">{fmt(i.purchasePrice!)}</td>
                        <td className="px-5 py-3 text-gray-500">
                          {i.ageMonths != null ? `${Math.round(i.ageMonths)} mo` : '—'}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-gray-900">{i.checkoutCount}</td>
                        <td className="px-5 py-3 tabular-nums text-gray-900">
                          {i.totalDaysOut > 0 ? `${i.totalDaysOut.toFixed(1)} d` : '—'}
                        </td>
                        <td className="px-5 py-3 tabular-nums font-semibold text-emerald-700">
                          {i.costPerCheckout != null ? fmt(i.costPerCheckout) : <span className="font-normal text-gray-400">Never used</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-emerald-100">
                              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${i.utilisationPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums">{i.utilisationPct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Currently checked out */}
          {(() => {
            const outItems = itemStats.filter((i) => i.status === 'checked_out');
            if (outItems.length === 0) return null;
            const outTotal = outItems.reduce((s, i) => s + (i.purchasePrice ?? 0), 0);
            return (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="mb-3 text-sm font-semibold text-blue-900">
                  Currently Checked Out — {outItems.length} items — Total Value: {fmt(outTotal)}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {outItems.map((i) => (
                    <span key={i.id} className="rounded-full bg-white border border-blue-200 px-3 py-1 text-xs text-blue-800">
                      {i.name}{i.purchasePrice ? ` — ${fmt(i.purchasePrice)}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {itemsMissingPriceCount > 0 && (
            <p className="text-center text-xs text-gray-400">
              {itemsMissingPriceCount} item{itemsMissingPriceCount !== 1 ? 's' : ''} without a purchase price are excluded from value calculations.
            </p>
          )}
        </div>
      )}

      {/* ── RESERVATIONS TAB ── */}
      {tab === 'reservations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Reservations" value={totalReservations} />
            <StatCard label="Approval Rate" value={`${approvalRate.toFixed(0)}%`} color="text-emerald-600" />
            <StatCard label="Cancellation Rate" value={`${cancellationRate.toFixed(0)}%`} color={cancellationRate > 30 ? 'text-red-600' : 'text-emerald-600'} />
            <StatCard label="Avg. Lead Time" value={`${avgLeadTime.toFixed(1)} days`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Reservations by Status</h2>
              {reservationsByStatus.length === 0 ? (
                <p className="text-sm text-gray-400">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={reservationsByStatus} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Reservations" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Most Reserved Items</h2>
              {topReservedItems.length === 0 ? (
                <p className="text-sm text-gray-400">No reservation data yet</p>
              ) : (
                <div className="space-y-2.5">
                  {topReservedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-4 text-right text-xs text-gray-400 tabular-nums">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-2 w-20 rounded-full bg-violet-100">
                          <div
                            className="h-2 rounded-full bg-violet-500"
                            style={{ width: `${Math.min(100, (item.count / (topReservedItems[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-sm font-semibold text-gray-900 tabular-nums">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number) {
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function StatCard({ label, value, color = 'text-gray-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
