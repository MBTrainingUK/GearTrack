import { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../context/useAuth';
import type { Organization } from '../../types';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, X, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function OrganizationsConsole() {
  const { appUser } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgLink, setNewOrgLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [form, setForm] = useState({ orgName: '', adminEmail: '', adminDisplayName: '' });

  useEffect(() => {
    if (!appUser?.isPlatformAdmin) return;
    return onSnapshot(collection(db, 'organizations'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Organization));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setOrgs(list);
      list.forEach((org) => {
        getDocs(query(collection(db, 'users'), where('orgId', '==', org.id)))
          .then((usersSnap) => setUserCounts((prev) => ({ ...prev, [org.id]: usersSnap.size })))
          .catch((err) => console.error(`User count query failed for org ${org.id}:`, err));
      });
    }, (err) => console.error('Organizations query failed:', err));
  }, [appUser?.isPlatformAdmin]);

  // Guard: only platform admins can access this page (checked after hooks to keep hook order stable)
  if (appUser && !appUser.isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  function closeCreateModal() {
    setShowCreate(false);
    setNewOrgLink(null);
    setForm({ orgName: '', adminEmail: '', adminDisplayName: '' });
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await httpsCallable<
        { orgName: string; adminEmail: string; adminDisplayName: string },
        { orgId: string; uid: string; resetLink: string }
      >(functions, 'createOrganization')(form);
      setNewOrgLink(result.data.resetLink);
      toast.success(`${form.orgName} created`);
    } catch (err) {
      console.error('createOrganization failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  }

  function formatDate(ts: Organization['createdAt'] | undefined) {
    if (!ts) return '—';
    try { return format(ts.toDate(), 'MMM d, yyyy'); } catch { return '—'; }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
            <Building2 size={18} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
            <p className="text-sm text-gray-500">{orgs.length} organization{orgs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New organization
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500">
              <th className="px-5 py-3 text-left font-medium">Organization</th>
              <th className="px-5 py-3 text-left font-medium">Created</th>
              <th className="px-5 py-3 text-left font-medium">Users</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{org.name}</td>
                <td className="px-5 py-3 text-gray-500">{formatDate(org.createdAt)}</td>
                <td className="px-5 py-3 text-gray-600">{userCounts[org.id] ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    org.status === 'suspended' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {org.status === 'suspended' ? 'Suspended' : 'Active'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            No organizations yet
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeCreateModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{newOrgLink ? 'Organization created' : 'New organization'}</h2>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {newOrgLink ? (
              <div className="px-6 py-5 space-y-3">
                <p className="text-sm text-gray-700">
                  <strong>{form.orgName}</strong> has been created with <strong>{form.adminDisplayName}</strong> as its first admin. Send them this link so they can set a password — there's no automated email, so share it yourself.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={newOrgLink}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                  />
                  <button
                    onClick={() => copyLink(newOrgLink)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {linkCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={closeCreateModal}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Organization name</label>
                  <input
                    required
                    value={form.orgName}
                    onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Acme Studios"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">First admin's name</label>
                  <input
                    required
                    value={form.adminDisplayName}
                    onChange={(e) => setForm((f) => ({ ...f, adminDisplayName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">First admin's email</label>
                  <input
                    required
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="jane@acme.com"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {creating ? 'Creating…' : 'Create organization'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
