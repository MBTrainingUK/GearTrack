import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Checkout } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart2 } from 'lucide-react';
import { startOfDay } from 'date-fns';

interface ItemStat {
  id: string;
  name: string;
  category: string;
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
  const [loading, setLoading] = useState(true);
  const [itemStats, setItemStats] = useState<ItemStat[]>([]);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [categoryStats, setCategoryStats] = useState<{ name: string; value: number }[]>([]);
  const [conditionStats, setConditionStats] = useState<{ name: string; value: number }[]>([]);
  const [avgDuration, setAvgDuration] = useState(0);
  const [overdueRate, setOverdueRate] = useState(0);
  const [neverUsed, setNeverUsed] = useState<Item[]>([]);
  const [tab, setTab] = useState<'items' | 'users' | 'overview'>('overview');

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'items')),
      getDocs(collection(db, 'checkouts')),
    ]).then(([itemsSnap, checkoutsSnap]) => {
      const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      const checkouts = checkoutsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkout));

      // --- Item stats ---
      const iMap: Record<string, ItemStat> = {};
      items.forEach((i) => {
        iMap[i.id] = { id: i.id, name: i.name, category: i.category, checkoutCount: 0, totalDaysOut: 0, conditionCounts: {} };
      });

      checkouts.forEach((c) => {
        c.itemIds.forEach((itemId) => {
          if (!iMap[itemId]) return;
          iMap[itemId].checkoutCount++;
          // Duration
          if (c.checkedOutAt && c.returnedAt) {
            const days = (c.returnedAt.toMillis() - c.checkedOutAt.toMillis()) / (1000 * 60 * 60 * 24);
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
      setNeverUsed(items.filter((i) => !iMap[i.id] || iMap[i.id].checkoutCount === 0));

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

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
        {(['overview', 'items', 'users'] as const).map((t) => (
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
    </div>
  );
}

function StatCard({ label, value, color = 'text-gray-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
