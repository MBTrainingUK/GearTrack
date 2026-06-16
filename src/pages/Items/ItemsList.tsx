import { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { Plus, Search, Package, Trash2 } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import ConditionBadge from '../../components/ConditionBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { writeAuditLog } from '../../lib/auditLog';
import { useItems } from '../../store/items';
import { useCategories } from '../../store/categories';

const CONDITIONS = [
  { value: 'all', label: 'All Conditions' },
  { value: 'good', label: 'Good' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'needs_investigating', label: 'Needs Investigating' },
  { value: 'damaged', label: 'Damaged' },
] as const;

export default function ItemsList() {
  const { appUser, currentUser } = useAuth();
  const { items } = useItems();
  const { categories } = useCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [condition, setCondition] = useState<'all' | 'good' | 'needs_attention' | 'needs_investigating' | 'damaged'>('all');

  async function handleDelete(id: string) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    const item = items.find((i) => i.id === id);
    try {
      await deleteDoc(doc(db, 'items', id));
      await writeAuditLog({
        action: 'delete_item',
        performedBy: currentUser!.uid,
        performedByName: appUser!.displayName,
        targetType: 'item',
        targetId: id,
        targetName: item?.name ?? 'Unknown item',
      });
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  }

  const filtered = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      item.assetNumber?.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || item.category === category;
    const matchCondition =
      condition === 'all' ||
      (condition === 'good' ? !item.condition || item.condition === 'good' : item.condition === condition);
    return matchSearch && matchCat && matchCondition;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Items</h1>
          <p className="mt-0.5 text-sm text-gray-500">{items.length} items in inventory</p>
        </div>
        {(appUser?.role === 'admin' || appUser?.role === 'manager') && (
          <Link
            to="/items/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Item
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, serial, category…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="All">All Categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as typeof condition)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white">
          <Package size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">No items found</p>
          {appUser?.role !== 'user' && (
            <Link to="/items/new" className="text-sm font-medium text-blue-600 hover:underline">
              Add your first item →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/items/${item.id}`} className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900 hover:text-blue-600">
                      {item.name}
                    </h3>
                  </Link>
                  <StatusBadge status={item.status} type="item" className="shrink-0" />
                </div>
                <p className="mt-1 text-xs text-gray-500">{item.category}</p>
                {item.assetNumber && (
                  <p className="text-xs text-gray-400">Asset: {item.assetNumber}</p>
                )}
                {item.serialNumber && (
                  <p className="text-xs text-gray-400">S/N: {item.serialNumber}</p>
                )}
                {item.condition && item.condition !== 'good' && (
                  <div className="mt-1.5">
                    <ConditionBadge condition={item.condition} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <Link
                    to={`/reservations/new?itemId=${item.id}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Reserve
                  </Link>
                  {appUser?.role !== 'user' && (
                    <div className="flex gap-2">
                      <Link
                        to={`/items/${item.id}/edit`}
                        className="text-xs text-gray-400 hover:text-gray-700"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
