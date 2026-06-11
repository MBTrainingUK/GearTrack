import { useState } from 'react';
import { doc, updateDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/useAuth';
import type { ConditionReport } from '../types';
import { writeAuditLog } from '../lib/auditLog';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  checkoutId: string;
  itemIds: string[];
  targetName: string;
  mode: 'checkout' | 'return';
  reservationId?: string;
  onClose: () => void;
  onConfirm: () => void;
}

const conditions = ['excellent', 'good', 'fair', 'poor', 'damaged'] as const;

export default function ConditionModal({ checkoutId, itemIds, targetName, mode, reservationId, onClose, onConfirm }: Props) {
  const { currentUser, appUser } = useAuth();
  const [condition, setCondition] = useState<ConditionReport['condition']>('good');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!currentUser || !appUser) return;
    setSaving(true);
    const report: ConditionReport = {
      condition,
      notes,
      photoURLs: [],
      reportedAt: Timestamp.now(),
      reportedBy: appUser.displayName,
    };

    const checkoutRef = doc(db, 'checkouts', checkoutId);
    try {
      if (mode === 'return') {
        // One atomic batch: the checkout, every item, and any linked
        // reservation all change together or not at all.
        const batch = writeBatch(db);
        batch.update(checkoutRef, {
          returnCondition: report,
          returnedAt: serverTimestamp(),
          status: 'returned',
        });
        // Update item statuses; auto-flag if condition is poor or damaged
        const autoFlagCondition =
          condition === 'damaged' ? 'damaged' :
          condition === 'poor' ? 'needs_investigating' :
          null;
        for (const itemId of itemIds) {
          batch.update(doc(db, 'items', itemId), {
            status: 'available',
            updatedAt: serverTimestamp(),
            ...(autoFlagCondition ? {
              condition: autoFlagCondition,
              conditionFlagNote: `Flagged on return: "${condition}" — ${notes || 'no notes'}`,
            } : {}),
          });
        }
        // If this checkout came from a reservation, mark it completed on return.
        if (reservationId) {
          batch.update(doc(db, 'reservations', reservationId), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } else {
        await updateDoc(checkoutRef, { checkoutCondition: report });
      }

      if (mode === 'return') {
        await writeAuditLog({
          action: 'checkin',
          performedBy: currentUser.uid,
          performedByName: appUser.displayName,
          targetType: 'checkout',
          targetId: checkoutId,
          targetName,
          details: { condition, notes },
        });
      }

      onConfirm();
    } catch {
      toast.error(mode === 'return' ? 'Failed to check in items' : 'Failed to save condition report');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === 'return' ? 'Return — Condition Report' : 'Check-out — Condition Report'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Condition</label>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                    condition === c
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Any damage, missing accessories, etc…"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : mode === 'return' ? 'Confirm Return' : 'Confirm Check-out'}
          </button>
        </div>
      </div>
    </div>
  );
}
