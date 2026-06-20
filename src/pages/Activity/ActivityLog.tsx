import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { AuditLog } from '../../types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  checkout: 'Checked out',
  checkin: 'Checked in',
  reserve: 'Created reservation',
  approve_reservation: 'Approved reservation',
  cancel_reservation: 'Cancelled reservation',
  flag: 'Flagged for inspection',
  resolve_flag: 'Passed inspection',
  create_item: 'Added item',
  update_item: 'Updated item',
  delete_item: 'Deleted item',
  create_kit: 'Created kit',
  delete_kit: 'Deleted kit',
};

const ACTION_COLOURS: Record<string, string> = {
  checkout: 'bg-blue-50 text-blue-700',
  checkin: 'bg-emerald-50 text-emerald-700',
  reserve: 'bg-violet-50 text-violet-700',
  approve_reservation: 'bg-emerald-50 text-emerald-700',
  cancel_reservation: 'bg-red-50 text-red-700',
  flag: 'bg-orange-50 text-orange-700',
  resolve_flag: 'bg-emerald-50 text-emerald-700',
  create_item: 'bg-blue-50 text-blue-700',
  update_item: 'bg-gray-100 text-gray-600',
  delete_item: 'bg-red-50 text-red-700',
  create_kit: 'bg-violet-50 text-violet-700',
  delete_kit: 'bg-red-50 text-red-700',
};

export default function ActivityLog() {
  const { appUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    if (!appUser?.orgId) return;
    return onSnapshot(
      query(collection(db, 'auditLog'), where('orgId', '==', appUser.orgId), orderBy('timestamp', 'desc'), limit(300)),
      (s) => {
        setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)));
        setLoading(false);
      },
      (err) => {
        console.error('ActivityLog query failed:', err);
        setLoading(false);
      }
    );
  }, [appUser?.orgId]);

  if (appUser && appUser.role === 'user') return <Navigate to="/" replace />;

  const users = Array.from(new Set(logs.map((l) => l.performedByName))).sort();
  const actions = Array.from(new Set(logs.map((l) => l.action))).sort();

  const filtered = logs.filter((l) => {
    if (userFilter !== 'all' && l.performedByName !== userFilter) return false;
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    return true;
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
      <div className="flex items-center gap-3">
        <Activity size={22} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
          <p className="text-sm text-gray-500">All user interactions across the system</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All users</option>
          {users.map((u) => <option key={u}>{u}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-gray-400">{filtered.length} entries</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-400">
              {logs.length === 0 ? 'No activity recorded yet' : 'No entries match the current filters'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-5 py-3 text-left font-medium">When</th>
                <th className="px-5 py-3 text-left font-medium">User</th>
                <th className="px-5 py-3 text-left font-medium">Action</th>
                <th className="px-5 py-3 text-left font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                    {log.timestamp ? format(log.timestamp.toDate(), 'dd MMM yyyy, HH:mm') : '—'}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{log.performedByName}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLOURS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{log.targetName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
