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
import type { AppUser, Item, Kit, Reservation } from '../../types';
import { useAuth } from '../../context/useAuth';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import ConditionBadge from '../../components/ConditionBadge';
import toast from 'react-hot-toast';
import { writeAuditLog } from '../../lib/auditLog';
import { isFlagged } from '../../lib/items';

export default function ReservationForm() {
  const { currentUser, appUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedItemId = searchParams.get('itemId');
  const preselectedKitId = searchParams.get('kitId');

  const [items, setItems] = useState<Item[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [orgUsers, setOrgUsers] = useState<AppUser[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>(preselectedItemId ? [preselectedItemId] : []);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(preselectedKitId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [kitWarnings, setKitWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!appUser?.orgId) return;
    const orgId = appUser.orgId;
    Promise.all([
      getDocs(query(collection(db, 'items'), where('orgId', '==', orgId))),
      getDocs(query(collection(db, 'kits'), where('orgId', '==', orgId))),
      getDocs(query(collection(db, 'users'), where('orgId', '==', orgId))),
    ]).then(([itemsSnap, kitsSnap, usersSnap]) => {
      const loadedItems = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      setItems(loadedItems);
      const loadedKits = kitsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Kit));
      setKits(loadedKits);
      const loadedUsers = usersSnap.docs.map((d) => ({ ...d.data() } as AppUser));
      setOrgUsers(loadedUsers);
      // Pre-select items for a kit passed in via ?kitId=
      if (preselectedKitId) {
        const kit = loadedKits.find((k) => k.id === preselectedKitId);
        if (kit) applyKitSelection(kit, loadedItems);
      }
    }).catch((err) => {
      console.error('Failed to load items/kits for reservation form:', err);
      toast.error('Failed to load items and kits');
    });
  }, [preselectedKitId, appUser?.orgId]);

  function applyKitSelection(kit: Kit, itemList: Item[]) {
    const available: string[] = [];
    const warned: string[] = [];
    kit.itemIds.forEach((id) => {
      const item = itemList.find((i) => i.id === id);
      if (!item || isFlagged(item) || item.status !== 'available') {
        warned.push(item?.name ?? id);
      } else {
        available.push(id);
      }
    });
    setSelectedItems(available);
    setKitWarnings(warned);
  }

  function selectKit(kit: Kit) {
    if (selectedKitId === kit.id) {
      // Deselect
      setSelectedKitId(null);
      setSelectedItems([]);
      setKitWarnings([]);
      return;
    }
    setSelectedKitId(kit.id);
    applyKitSelection(kit, items);
  }

  async function checkConflicts(itemIds: string[], start: Date, end: Date): Promise<string[]> {
    const results = await Promise.all(
      itemIds.map(async (itemId) => {
        const q = query(
          collection(db, 'reservations'),
          where('orgId', '==', appUser!.orgId),
          where('itemIds', 'array-contains', itemId),
          where('status', 'in', ['pending', 'approved', 'checked_out'])
        );
        const snap = await getDocs(q);
        const clash = snap.docs.some((d) => {
          const r = d.data() as Reservation;
          return start < r.endDate.toDate() && end > r.startDate.toDate();
        });
        return clash ? itemId : null;
      })
    );
    return results.filter((id): id is string => id !== null);
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
    const canAssign = appUser.role === 'admin' || appUser.role === 'manager';
    const assignedUser = canAssign && assignedUserId
      ? orgUsers.find((u) => u.uid === assignedUserId)
      : null;
    const reservationUserId = assignedUser ? assignedUser.uid : currentUser.uid;
    const reservationUserName = assignedUser ? assignedUser.displayName : appUser.displayName;
    const reservationUserEmail = assignedUser ? assignedUser.email : appUser.email;

    try {
      const cfls = await checkConflicts(selectedItems, start, end);
      if (cfls.length > 0) {
        setConflicts(cfls);
        toast.error(`${cfls.length} item(s) have conflicting reservations`);
        setSaving(false);
        return;
      }

      const resRef = await addDoc(collection(db, 'reservations'), {
        orgId: appUser.orgId,
        userId: reservationUserId,
        userName: reservationUserName,
        userEmail: reservationUserEmail,
        itemIds: selectedItems,
        kitId: selectedKitId ?? null,
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        status: 'approved',
        autoCheckout: true,
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const targetName = selectedKitId
        ? (kits.find((k) => k.id === selectedKitId)?.name ?? 'Kit')
        : selectedItems.slice(0, 2).map((id) => items.find((i) => i.id === id)?.name ?? 'Item').join(', ') +
          (selectedItems.length > 2 ? ` +${selectedItems.length - 2} more` : '');
      await writeAuditLog({
        orgId: appUser.orgId,
        action: 'reserve',
        performedBy: currentUser.uid,
        performedByName: appUser.displayName,
        targetType: 'reservation',
        targetId: resRef.id,
        targetName,
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
    if (item && isFlagged(item)) return;
    // Manually picking an item deselects any active kit
    if (selectedKitId) { setSelectedKitId(null); setKitWarnings([]); }
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const filteredItems = items.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.assetNumber ?? '').toLowerCase().includes(q) ||
      (i.serialNumber ?? '').toLowerCase().includes(q)
    );
  });

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

        {/* Assign to (admin/manager only) */}
        {(appUser?.role === 'admin' || appUser?.role === 'manager') && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Assign To</h2>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Myself ({appUser.displayName})</option>
              {orgUsers
                .filter((u) => u.uid !== currentUser?.uid)
                .sort((a, b) => a.displayName.localeCompare(b.displayName))
                .map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
            </select>
            <p className="mt-2 text-xs text-gray-400">
              The reservation will be created in this person's name and auto-checked out at the start time.
            </p>
          </div>
        )}

        {/* Kit picker */}
        {kits.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Book a Kit (optional)</h2>
            <div className="flex flex-wrap gap-2">
              {kits.map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => selectKit(kit)}
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
            {kitWarnings.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                <span>
                  {selectedItems.length} of {selectedItems.length + kitWarnings.length} items selected —{' '}
                  <strong>{kitWarnings.join(', ')}</strong>{' '}
                  {kitWarnings.length === 1 ? 'is' : 'are'} currently unavailable and won't be included.
                </span>
              </div>
            )}
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
              const isBlocked = isFlagged(item);
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
                    <p className="text-xs text-gray-500">
                      {item.category}
                      {item.assetNumber && <span className="ml-2">· Asset: {item.assetNumber}</span>}
                      {!item.assetNumber && item.serialNumber && <span className="ml-2">· S/N: {item.serialNumber}</span>}
                    </p>
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
