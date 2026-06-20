import { collection, doc, getDocs, query, where, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: string;
  items: Record<string, unknown>[];
  kits: Record<string, unknown>[];
}

// Firestore Timestamps don't survive JSON.stringify — serialize as ISO strings,
// then restore them on import so date fields keep working with date-fns/Timestamp.toDate().
function serialize(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'photoURLs') continue;
    out[key] = value instanceof Timestamp ? { __timestamp: value.toDate().toISOString() } : value;
  }
  return out;
}

function deserialize(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value && typeof value === 'object' && '__timestamp' in value) {
      out[key] = Timestamp.fromDate(new Date((value as { __timestamp: string }).__timestamp));
    } else {
      out[key] = value;
    }
  }
  out.photoURLs = [];
  return out;
}

export async function exportBackup(orgId: string): Promise<void> {
  const [itemsSnap, kitsSnap] = await Promise.all([
    getDocs(query(collection(db, 'items'), where('orgId', '==', orgId))),
    getDocs(query(collection(db, 'kits'), where('orgId', '==', orgId))),
  ]);

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: itemsSnap.docs.map((d) => serialize({ id: d.id, ...d.data() })),
    kits: kitsSnap.docs.map((d) => serialize({ id: d.id, ...d.data() })),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `geartrack-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackupFile(text: string): BackupFile {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !Array.isArray(data.items) || !Array.isArray(data.kits)) {
    throw new Error('This file does not look like a GearTrack backup.');
  }
  return data as BackupFile;
}

export async function importBackup(backup: BackupFile, orgId: string): Promise<{ items: number; kits: number }> {
  const batches: ReturnType<typeof writeBatch>[] = [];
  let opCount = 0;
  function nextBatch() {
    if (opCount % 500 === 0) batches.push(writeBatch(db));
    opCount++;
    return batches[batches.length - 1];
  }

  // orgId is always set to the importing org, regardless of what's in the
  // file — a backup should never be able to plant data into another org.
  for (const raw of backup.items) {
    const { id, ...rest } = deserialize(raw);
    nextBatch().set(doc(db, 'items', id as string), { ...rest, orgId }, { merge: false });
  }
  for (const raw of backup.kits) {
    const { id, ...rest } = deserialize(raw);
    nextBatch().set(doc(db, 'kits', id as string), { ...rest, orgId }, { merge: false });
  }

  await Promise.all(batches.map((b) => b.commit()));
  return { items: backup.items.length, kits: backup.kits.length };
}
