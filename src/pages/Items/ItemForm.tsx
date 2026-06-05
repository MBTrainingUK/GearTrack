import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item } from '../../types';
import PhotoUpload from '../../components/PhotoUpload';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const CATEGORIES = ['Camera', 'Lighting', 'Audio', 'Lens', 'Tripod', 'Computer', 'Other'];

export default function ItemForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Camera',
    serialNumber: '',
    location: '',
    purchasePrice: '',
    notes: '',
  });
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
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
          location: d.location ?? '',
          purchasePrice: d.purchasePrice?.toString() ?? '',
          notes: d.notes ?? '',
        });
        setPhotoURLs(d.photoURLs ?? []);
      }
      setLoading(false);
    });
  }, [id]);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      photoURLs,
      updatedAt: serverTimestamp(),
    };
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'items', id!), data);
        toast.success('Item updated');
      } else {
        await addDoc(collection(db, 'items'), {
          ...data,
          status: 'available',
          createdAt: serverTimestamp(),
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
        {/* Photos */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Photos</label>
          <PhotoUpload
            folder={`items/${id ?? 'new'}`}
            urls={photoURLs}
            onChange={setPhotoURLs}
            maxFiles={5}
          />
        </div>

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
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Serial Number</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Price ($)</label>
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
