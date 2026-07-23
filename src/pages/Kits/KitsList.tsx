import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Kit } from '../../types';
import { Link } from 'react-router-dom';
import { Plus, Layers, X, Check, Trash2, Edit } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { writeAuditLog } from '../../lib/auditLog';
import { useItems } from '../../store/items';
import { useCategories } from '../../store/categories';
import { isCategoryExcluded } from '../../lib/items';

export default function KitsList() {
  const { appUser, currentUser } = useAuth();
  const [kits, setKits] = useState<Kit[]>([]);
  const { items } = useItems();
  const { excludedCategories } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!appUser?.orgId) return;
    return onSnapshot(
      query(collection(db, 'kits'), where('orgId', '==', appUser.orgId)),
      (s) => setKits(s.docs.map((d) => ({ id: d.id, ...d.data() } as Kit))),
      (err) => console.error('Kits query failed:', err)
    );
  }, [appUser?.orgId]);

  async function handleDelete(kit: Kit) {
    if (!confirm(`Delete kit "${kit.name}"?`)) return;
    try {
      // Items are not owned by kits, so just delete the kit document
      const batch = writeBatch(db);
      batch.delete(doc(db, 'kits', kit.id));
      await batch.commit();
      await writeAuditLog({
        orgId: appUser!.orgId,
        action: 'delete_kit',
        performedBy: currentUser!.uid,
        performedByName: appUser!.displayName,
        targetType: 'kit',
        targetId: kit.id,
        targetName: kit.name,
      });
      toast.success('Kit deleted');
    } catch {
      toast.error('Failed to delete kit');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kits</h1>
          <p className="mt-0.5 text-sm text-gray-500">{kits.length} kit bundles</p>
        </div>
        {appUser?.role !== 'user' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            New Kit
          </button>
        )}
      </div>

      {kits.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white">
          <Layers size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">No kits yet</p>
          {appUser?.role !== 'user' && (
            <button onClick={() => setShowForm(true)} className="text-sm font-medium text-blue-600 hover:underline">
              Create your first kit →
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => {
            const kitItems = items.filter((i) => kit.itemIds.includes(i.id));
            const isExpanded = expandedKits.has(kit.id);
            const visibleItems = isExpanded ? kitItems : kitItems.slice(0, 4);
            return (
              <div key={kit.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                      <Layers size={18} className="text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{kit.name}</h3>
                      <p className="text-xs text-gray-500">{kit.itemIds.length} items</p>
                    </div>
                  </div>
                  {appUser?.role !== 'user' && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingKit(kit)} className="text-gray-300 hover:text-blue-500">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => handleDelete(kit)} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {kit.description && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">{kit.description}</p>
                )}
                <ul className="mt-3 space-y-1">
                  {visibleItems.map((i) => {
                    const excluded = isCategoryExcluded(i, excludedCategories);
                    return (
                    <li key={i.id} className={`flex items-center justify-between rounded px-1.5 py-0.5 text-xs ${excluded ? 'border border-amber-400 bg-amber-50' : ''}`}>
                      <span className="text-gray-700">{i.name}</span>
                      <div className="flex items-center gap-2">
                        {(i.assetNumber || i.serialNumber) && (
                          <span className="text-gray-400">#{i.assetNumber || i.serialNumber}</span>
                        )}
                        {excluded
                          ? <span className="text-amber-600">Not bookable</span>
                          : <StatusBadge status={i.status} type="item" />}
                      </div>
                    </li>
                    );
                  })}
                  {kitItems.length > 4 && (
                    <li>
                      <button
                        onClick={() =>
                          setExpandedKits((prev) => {
                            const next = new Set(prev);
                            if (isExpanded) next.delete(kit.id);
                            else next.add(kit.id);
                            return next;
                          })
                        }
                        className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                      >
                        {isExpanded ? 'Show less' : `+${kitItems.length - 4} more`}
                      </button>
                    </li>
                  )}
                </ul>
                <div className="mt-4">
                  <Link
                    to={`/reservations/new?kitId=${kit.id}`}
                    className="block w-full rounded-lg border border-blue-200 bg-blue-50 py-1.5 text-center text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Reserve Kit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showForm || editingKit) && (
        <KitFormModal
          items={items}
          currentUser={currentUser}
          appUser={appUser}
          editingKit={editingKit}
          onClose={() => { setShowForm(false); setEditingKit(null); }}
        />
      )}
    </div>
  );
}

function KitFormModal({ items, onClose, currentUser, appUser, editingKit }: { items: Item[]; onClose: () => void; currentUser: { uid: string } | null; appUser: { displayName: string; orgId: string } | null; editingKit?: Kit | null }) {
  const [name, setName] = useState(editingKit?.name ?? '');
  const [description, setDescription] = useState(editingKit?.description ?? '');
  const [selectedItems, setSelectedItems] = useState<string[]>(editingKit?.itemIds ?? []);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const availableItems = items.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleItem(id: string) {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!name || selectedItems.length === 0) {
      toast.error('Name and at least one item are required');
      return;
    }
    setSaving(true);
    try {
      if (editingKit) {
        await updateDoc(doc(db, 'kits', editingKit.id), {
          name,
          description,
          itemIds: selectedItems,
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog({
          orgId: appUser!.orgId,
          action: 'update_kit',
          performedBy: currentUser!.uid,
          performedByName: appUser!.displayName,
          targetType: 'kit',
          targetId: editingKit.id,
          targetName: name,
        });
        toast.success('Kit updated');
      } else {
        // Items are not owned by kits; just create the kit document
        const ref = doc(collection(db, 'kits'));
        const batch = writeBatch(db);
        batch.set(ref, {
          orgId: appUser!.orgId,
          name,
          description,
          itemIds: selectedItems,
          photoURLs: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        await writeAuditLog({
          orgId: appUser!.orgId,
          action: 'create_kit',
          performedBy: currentUser!.uid,
          performedByName: appUser!.displayName,
          targetType: 'kit',
          targetId: ref.id,
          targetName: name,
        });
        toast.success('Kit created');
      }
      onClose();
    } catch {
      toast.error(editingKit ? 'Failed to update kit' : 'Failed to create kit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="font-semibold text-gray-900">{editingKit ? 'Edit Kit' : 'Create Kit'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kit Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Studio Lighting Kit"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Add Items ({selectedItems.length} selected)
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {availableItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${
                    selectedItems.includes(item.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-gray-900">{item.name}</span>
                  <div className="flex items-center gap-2">
                    {(item.assetNumber || item.serialNumber) && (
                      <span className="text-xs text-gray-400">#{item.assetNumber || item.serialNumber}</span>
                    )}
                    <StatusBadge status={item.status} type="item" />
                    {selectedItems.includes(item.id) && <Check size={14} className="text-blue-600" />}
                  </div>
                </button>
              ))}
              {availableItems.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-gray-400">No items found</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? (editingKit ? 'Saving…' : 'Creating…') : (editingKit ? 'Save Changes' : 'Create Kit')}
          </button>
        </div>
      </div>
    </div>
  );
}
