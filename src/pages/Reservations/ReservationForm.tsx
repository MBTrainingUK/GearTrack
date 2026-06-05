import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Item, Kit, Reservation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Check } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import ConditionBadge from '../../components/ConditionBadge';
import toast from 'react-hot-toast';

export default function ReservationForm() {
  const { currentUser, appUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedItemId = searchParams.get('itemId');
  const preselectedKitId = searchParams.get('kitId');

  const [items, setItems] = useState<Item[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>(preselectedItemId ? [preselectedItemId] : []);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(preselectedKitId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'items')),
      getDocs(collection(db, 'kits')),
    ]).then(([itemsSnap, kitsSnap]) => {
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
      setKits(kitsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Kit)));
    });
  }, []);

  // Auto-select kit items when kit chosen
  useEffect(() => {
    if (!selectedKitId) return;
    const kit = kits.find((k) => k.id === selectedKitId);
    if (kit) setSelectedItems(kit.itemIds);
  }, [selectedKitId, kits]);

  async function checkConflicts(itemIds: string[], start: Date, end: Date): Promise<string[]> {
    const conflicted: string[] = [];
    for (const itemId of itemIds) {
      const q = query(
        collection(db, 'reservations'),
        where('itemIds', 'array-contains', itemId),
        where('status', 'in', ['pending', 'approved', 'checked_out'])
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const r = d.data() as Reservation;
        const rStart = r.startDate.toDate();
        const rEnd = r.endDate.toDate();
        if (start < rEnd && end > rStart) {
          conflicted.push(itemId);
          break;
        }
      }
    }
    return conflicted;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !appUser) return;
    if (selectedItems.length === 0) {
      toast.error('Select at least one item');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Select start and end date/time');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      toast.error('End must be after start');
      return;
    }

    setSaving(true);
    try {
      const cfls = await checkConflicts(selectedItems, start, end);
      if (cfls.length > 0) {
        setConflicts(cfls);
        toast.error(`${cfls.length} item(s) have conflicting reservations`);
        setSaving(false);
        return;
      }

      await addDoc(collection(db, 'reservations'), {
        userId: currentUser.uid,
        userName: appUser.displayName,
        userEmail: appUser.email,
        itemIds: selectedItems,
        kitId: selectedKitId ?? null,
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        status: appUser.role === 'user' ? 'pending' : 'approved',
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Reservation created');
      navigate('/reservations');
    } catch {
      toast.error('Failed to create reservation');
    } finally {
      setSaving(false);
    }
  }

  function toggleItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.condition === 'needs_attention' || item?.condition === 'damaged') return;
    setSelectedKitId(null);
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const filteredItems = items.filter(
    (i) =>
      !i.kitId &&
      (i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Reservation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date range */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Date & Time Range</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start *</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End *</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Kit picker */}
        {kits.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Book a Kit (optional)</h2>
            <div className="flex flex-wrap gap-2">
              {kits.map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() =>
                    setSelectedKitId((prev) => (prev === kit.id ? null : kit.id))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedKitId === kit.id
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-600 hover:border-violet-300'
                  }`}
                >
                  {kit.name} ({kit.itemIds.length} items)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Item picker */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Select Items ({selectedItems.length} selected)
          </h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {filteredItems.map((item) => {
              const isConflict = conflicts.includes(item.id);
              const isSelected = selectedItems.includes(item.id);
              const isBlocked = item.condition === 'needs_attention' || item.condition === 'damaged';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  disabled={isBlocked}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-sm ${
                    isBlocked ? 'cursor-not-allowed opacity-60 bg-gray-50' : 'hover:bg-gray-50'
                  } ${isSelected ? 'bg-blue-50' : ''} ${isConflict ? 'bg-red-50' : ''}`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConflict && <span className="text-xs text-red-600">Conflict</span>}
                    {isBlocked
                      ? <ConditionBadge condition={item.condition} />
                      : <StatusBadge status={item.status} type="item" />}
                    {isSelected && !isBlocked && <Check size={14} className="text-blue-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-gray-400">No items found</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Purpose of reservation, special requirements…"
          />
        </div>

        {appUser?.role === 'user' && (
          <p className="text-xs text-gray-500 text-center">
            Your reservation will be submitted for admin approval.
          </p>
        )}

        <div className="flex justify-end gap-3">
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
            {saving ? 'Checking availability…' : 'Create Reservation'}
          </button>
        </div>
      </form>
    </div>
  );
}
