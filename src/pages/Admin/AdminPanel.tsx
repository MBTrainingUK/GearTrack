import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/useAuth';
import type { AppUser, UserRole } from '../../types';
import { exportBackup, importBackup, parseBackupFile } from '../../lib/backup';
import { Shield, UserCheck, User, ChevronDown, Trash2, X, AlertTriangle, Download, Upload } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Team Member',
  user: 'User',
};

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
  const [confirmRemove, setConfirmRemove] = useState<AppUser | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [purgingOld, setPurgingOld] = useState(false);
  const [confirmPurgeOld, setConfirmPurgeOld] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ items: number; kits: number; backup: Parameters<typeof importBackup>[0] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data() } as AppUser));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setUsers(list);
    });
  }, []);

  // Silently purge records older than 180 days whenever an admin visits this page
  useEffect(() => {
    if (!appUser || appUser.role !== 'admin') return;
    const cutoff = Timestamp.fromDate(subDays(new Date(), 180));
    (async () => {
      try {
        for (const { col, field } of [
          { col: 'checkouts', field: 'checkedOutAt' },
          { col: 'reservations', field: 'createdAt' },
        ]) {
          const snap = await getDocs(query(collection(db, col), where(field, '<', cutoff)));
          if (snap.empty) continue;
          const batches: ReturnType<typeof writeBatch>[] = [];
          snap.docs.forEach((d, i) => {
            if (i % 500 === 0) batches.push(writeBatch(db));
            batches[batches.length - 1].delete(d.ref);
          });
          await Promise.all(batches.map((b) => b.commit()));
        }
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.uid]);

  // Guard: only admins can access this page (checked after hooks to keep hook order stable)
  if (appUser && appUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  async function changeRole(uid: string, newRole: UserRole) {
    if (uid === currentUser?.uid && newRole !== 'admin') {
      toast.error("You can't demote yourself");
      return;
    }
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeUser(u: AppUser) {
    setRemovingId(u.uid);
    setConfirmRemove(null);
    try {
      await deleteDoc(doc(db, 'users', u.uid));
      toast.success(`${u.displayName} removed`);
    } catch {
      toast.error('Failed to remove user');
    } finally {
      setRemovingId(null);
    }
  }

  async function clearTestData() {
    setClearingData(true);
    setConfirmClearData(false);
    try {
      const collectionsToWipe = ['auditLog', 'checkouts', 'reservations'];
      for (const name of collectionsToWipe) {
        const snap = await getDocs(collection(db, name));
        const batches: ReturnType<typeof writeBatch>[] = [];
        snap.docs.forEach((d, i) => {
          if (i % 500 === 0) batches.push(writeBatch(db));
          batches[batches.length - 1].delete(d.ref);
        });
        await Promise.all(batches.map((b) => b.commit()));
      }
      toast.success('Test data cleared — activity log, checkouts, and reservations wiped');
    } catch {
      toast.error('Failed to clear test data');
    } finally {
      setClearingData(false);
    }
  }

  async function purgeOldRecords() {
    setPurgingOld(true);
    setConfirmPurgeOld(false);
    const cutoff = Timestamp.fromDate(subDays(new Date(), 180));
    let total = 0;
    try {
      for (const { col, field } of [
        { col: 'checkouts', field: 'checkedOutAt' },
        { col: 'reservations', field: 'createdAt' },
      ]) {
        const snap = await getDocs(query(collection(db, col), where(field, '<', cutoff)));
        if (snap.empty) continue;
        const batches: ReturnType<typeof writeBatch>[] = [];
        snap.docs.forEach((d, i) => {
          if (i % 500 === 0) batches.push(writeBatch(db));
          batches[batches.length - 1].delete(d.ref);
        });
        await Promise.all(batches.map((b) => b.commit()));
        total += snap.size;
      }
      if (total > 0) toast.success(`Purged ${total} record${total !== 1 ? 's' : ''} older than 180 days`);
      else toast.success('No records older than 180 days found');
    } catch {
      toast.error('Failed to purge old records');
    } finally {
      setPurgingOld(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportBackup();
      toast.success('Backup downloaded');
    } catch {
      toast.error('Failed to export backup');
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const backup = parseBackupFile(text);
      setPendingImport({ items: backup.items.length, kits: backup.kits.length, backup });
    } catch {
      toast.error('Could not read that file — is it a GearTrack backup?');
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    try {
      const result = await importBackup(pendingImport.backup);
      toast.success(`Restored ${result.items} items and ${result.kits} kits`);
    } catch {
      toast.error('Failed to import backup');
    } finally {
      setImporting(false);
      setPendingImport(null);
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
            <span>{ROLE_LABELS[r]}</span>
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
              <th className="px-5 py-3 text-left font-medium">Actions</th>
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
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[u.role]}`}>
                    {roleIcons[u.role]}
                    {ROLE_LABELS[u.role]}
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
                      <option value="manager">Team Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </td>
                <td className="px-5 py-3">
                  {u.uid !== currentUser?.uid && (
                    <button
                      onClick={() => setConfirmRemove(u)}
                      disabled={removingId === u.uid}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  )}
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
      {/* Backup & restore */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-800">Backup & Restore</h2>
        </div>
        <p className="text-xs text-gray-500">
          Export all items and kits to a JSON file you can keep somewhere safe, and restore from it if your data is ever lost.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export backup'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload size={14} />
            {importing ? 'Restoring…' : 'Import backup'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Purge old records</p>
            <p className="text-xs text-gray-500 mt-0.5">Permanently deletes checkouts and reservations older than 180 days. This also runs automatically each time you visit this page.</p>
          </div>
          <button
            onClick={() => setConfirmPurgeOld(true)}
            disabled={purgingOld}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {purgingOld ? 'Purging…' : 'Purge now'}
          </button>
        </div>
        <div className="border-t border-red-200" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Clear test data</p>
            <p className="text-xs text-gray-500 mt-0.5">Permanently deletes all activity logs, checkouts, and reservations. Items and kits are kept.</p>
          </div>
          <button
            onClick={() => setConfirmClearData(true)}
            disabled={clearingData}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {clearingData ? 'Clearing…' : 'Clear test data'}
          </button>
        </div>
      </div>

      {confirmClearData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmClearData(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Clear test data?</h2>
              <button onClick={() => setConfirmClearData(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">This will permanently delete:</p>
              <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                <li>All activity log entries</li>
                <li>All checkouts</li>
                <li>All reservations</li>
              </ul>
              <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                Items and kits will not be affected. This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setConfirmClearData(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={clearTestData}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, clear it all
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPurgeOld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmPurgeOld(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Purge old records?</h2>
              <button onClick={() => setConfirmPurgeOld(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">This will permanently delete all checkouts and reservations older than <strong>180 days</strong>.</p>
              <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                Active checkouts and upcoming reservations will not be affected. This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setConfirmPurgeOld(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={purgeOldRecords}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Purge old records
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingImport(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Restore backup?</h2>
              <button onClick={() => setPendingImport(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">
                This file contains <strong>{pendingImport.items} items</strong> and <strong>{pendingImport.kits} kits</strong>.
              </p>
              <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                Any existing items or kits with matching IDs will be overwritten. This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setPendingImport(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmRemove(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Remove User</h2>
              <button onClick={() => setConfirmRemove(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">
                Are you sure you want to remove <strong>{confirmRemove.displayName}</strong>?
              </p>
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This removes their account from GearTrack. If they log in again they will be added back as a basic user.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setConfirmRemove(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => removeUser(confirmRemove)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
