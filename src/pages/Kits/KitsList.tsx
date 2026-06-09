import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Kit } from '../../types';
import { Link } from 'react-router-dom';
import { Plus, Layers, X, Check, Trash2 } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';

export default function KitsList() {
  const { appUser } = useAuth();
  const [kits, setKits] = useState<Kit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'kits'), (s) =>
        setKits(s.docs.map((d) => ({ id: d.id, ...d.data() } as Kit)))
      ),
      onSnapshot(collection(db, 'items'), (s) =>
        setItems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Item)))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  async function handleDelete(kit: Kit) {
    if (!confirm(`Delete kit "${kit.name}"?`)) return;
    try {
      // Unlink items from this kit
      for (const itemId of kit.itemIds) {
        await updateDoc(doc(db, 'items', itemId), { kitId: null });
      }
      await deleteDoc(doc(db, 'kits', kit.id));
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
                    <button onClick={() => handleDelete(kit)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {kit.description && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">{kit.description}</p>
                )}
                <ul className="mt-3 space-y-1">
                  {visibleItems.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{i.name}</span>
                      <div className="flex items-center gap-2">
                        {(i.assetNumber || i.serialNumber) && (
                          <span className="text-gray-400">#{i.assetNumber || i.serialNumber}</span>
                        )}
                        <StatusBadge status={i.status} type="item" />
                      </div>
                    </li>
                  ))}
                  {kitItems.length > 4 && (
                    <li>
                      <button
                        onClick={() =>
                          setExpandedKits((prev) => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(kit.id) : next.add(kit.id);
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

      {showForm && (
        <KitFormModal
          items={items}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function KitFormModal({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const availableItems = items.filter(
    (i) => !i.kitId && i.name.toLowerCase().includes(search.toLowerCase())
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
      const ref = await addDoc(collection(db, 'kits'), {
        name,
        description,
        itemIds: selectedItems,
        photoURLs: [],
        status: 'available',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Link items to this kit
      for (const itemId of selectedItems) {
        await updateDoc(doc(db, 'items', itemId), { kitId: ref.id });
      }
      toast.success('Kit created');
      onClose();
    } catch {
      toast.error('Failed to create kit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="font-semibold text-gray-900">Create Kit</h2>
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
                <p className="px-3 py-4 text-center text-xs text-gray-400">No available items</p>
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
            {saving ? 'Creating…' : 'Create Kit'}
          </button>
        </div>
      </div>
    </div>
  );
}
