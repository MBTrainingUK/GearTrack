import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item } from '../../types';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { writeAuditLog } from '../../lib/auditLog';
import { useCategories, addCategory } from '../../store/categories';

export default function ItemForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, appUser } = useAuth();
  const { categories } = useCategories();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Camera',
    serialNumber: '',
    assetNumber: '',
    location: '',
    purchaseDate: '',
    purchasePrice: '',
    expectedLifespanMonths: '',
    condition: 'good',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'items', id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as Item;
        setForm({
          name: d.name,
          description: d.description,
          category: d.category,
          serialNumber: d.serialNumber ?? '',
          assetNumber: d.assetNumber ?? '',
          location: d.location ?? '',
          purchaseDate: d.purchaseDate ? d.purchaseDate.toDate().toISOString().slice(0, 10) : '',
          purchasePrice: d.purchasePrice?.toString() ?? '',
          expectedLifespanMonths: d.expectedLifespanMonths?.toString() ?? '',
          condition: d.condition ?? 'good',
          notes: d.notes ?? '',
        });
      }
      setLoading(false);
    });
  }, [id]);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleAddCategory() {
    const name = window.prompt('New category name:')?.trim();
    if (!name) return;
    try {
      await addCategory(name, appUser!.orgId);
      set('category', name);
    } catch {
      toast.error('Failed to add category');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      purchaseDate: form.purchaseDate ? Timestamp.fromDate(new Date(form.purchaseDate)) : null,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      expectedLifespanMonths: form.expectedLifespanMonths ? Number(form.expectedLifespanMonths) : null,
      // Setting condition back to good clears any stale flag note
      ...(form.condition === 'good' ? { conditionFlagNote: '' } : {}),
      updatedAt: serverTimestamp(),
    };
    try {
      if (isEdit) {
        // Don't write photoURLs on edit — it would wipe any existing photos.
        await updateDoc(doc(db, 'items', id!), data);
        await writeAuditLog({
          orgId: appUser!.orgId,
          action: 'update_item',
          performedBy: currentUser!.uid,
          performedByName: appUser!.displayName,
          targetType: 'item',
          targetId: id!,
          targetName: form.name,
        });
        toast.success('Item updated');
      } else {
        const docRef = await addDoc(collection(db, 'items'), {
          ...data,
          orgId: appUser!.orgId,
          photoURLs: [],
          status: 'available',
          createdAt: serverTimestamp(),
        });
        await writeAuditLog({
          orgId: appUser!.orgId,
          action: 'create_item',
          performedBy: currentUser!.uid,
          performedByName: appUser!.displayName,
          targetType: 'item',
          targetId: docRef.id,
          targetName: form.name,
        });
        toast.success('Item added');
      }
      navigate('/items');
    } catch {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Item' : 'Add New Item'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Canon EOS R5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
            <div className="flex gap-2">
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button
                type="button"
                onClick={handleAddCategory}
                title="Add a new category"
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                + Add
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Asset No.</label>
            <input
              value={form.assetNumber}
              onChange={(e) => set('assetNumber', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="GT-001"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Serial No.</label>
            <input
              value={form.serialNumber}
              onChange={(e) => set('serialNumber', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="SN-00123"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Studio A, Shelf 3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => set('condition', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="good">Good</option>
              <option value="attention_needed">Attention needed</option>
              <option value="needs_investigating">Needs investigating</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Date</label>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => set('purchaseDate', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Price (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => set('purchasePrice', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="2499.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Inspection Interval (months)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.expectedLifespanMonths}
              onChange={(e) => set('expectedLifespanMonths', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 24"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Brief description of this item…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Internal notes, special handling instructions…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
