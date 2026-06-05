import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import type { AppUser, UserRole } from '../../types';
import { Shield, UserCheck, User, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';

const roleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-violet-100 text-violet-700',
  user: 'bg-gray-100 text-gray-600',
};

const roleIcons: Record<UserRole, React.ReactNode> = {
  admin: <Shield size={12} />,
  manager: <UserCheck size={12} />,
  user: <User size={12} />,
};

export default function AdminPanel() {
  const { appUser, currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Guard: only admins can access this page
  if (appUser && appUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data() } as AppUser));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setUsers(list);
    });
  }, []);

  async function changeRole(uid: string, newRole: UserRole) {
    if (uid === currentUser?.uid && newRole !== 'admin') {
      toast.error("You can't demote yourself");
      return;
    }
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success(`Role updated to ${newRole}`);
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(ts: Timestamp | undefined) {
    if (!ts) return '—';
    try { return format(ts.toDate(), 'MMM d, yyyy'); } catch { return '—'; }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
          <Shield size={18} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {(['admin', 'manager', 'user'] as UserRole[]).map((r) => (
          <div key={r} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${roleColors[r]}`}>
            {roleIcons[r]}
            <span className="capitalize">{r}</span>
            <span className="opacity-60">—</span>
            <span className="font-normal opacity-80">
              {r === 'admin' ? 'Full access' : r === 'manager' ? 'Manage checkouts & reservations' : 'Book only'}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500">
              <th className="px-5 py-3 text-left font-medium">User</th>
              <th className="px-5 py-3 text-left font-medium">Email</th>
              <th className="px-5 py-3 text-left font-medium">Registered</th>
              <th className="px-5 py-3 text-left font-medium">Role</th>
              <th className="px-5 py-3 text-left font-medium">Change Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.uid} className={`hover:bg-gray-50 ${u.uid === currentUser?.uid ? 'bg-blue-50/40' : ''}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {u.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="font-medium text-gray-900">
                      {u.displayName}
                      {u.uid === currentUser?.uid && (
                        <span className="ml-1.5 text-xs font-normal text-blue-500">(you)</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{u.email}</td>
                <td className="px-5 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${roleColors[u.role]}`}>
                    {roleIcons[u.role]}
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="relative inline-block">
                    <select
                      value={u.role}
                      disabled={updatingId === u.uid}
                      onChange={(e) => changeRole(u.uid, e.target.value as UserRole)}
                      className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            No users yet
          </div>
        )}
      </div>
    </div>
  );
}
