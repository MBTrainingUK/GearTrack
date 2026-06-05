import { Timestamp } from 'firebase/firestore';

// ── User ─────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'manager' | 'user';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  createdAt: Timestamp;
  lastLogin?: Timestamp;
}

// ── Item ─────────────────────────────────────────────────────────────
export type ItemStatus =
  | 'available'
  | 'checked_out'
  | 'reserved'
  | 'maintenance'
  | 'flagged';

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  serialNumber?: string;
  status: ItemStatus;
  photoURLs: string[];
  location?: string;
  purchaseDate?: Timestamp;
  purchasePrice?: number;
  kitId?: string;
  customFields?: Record<string, string>;
  qrCode?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Kit ──────────────────────────────────────────────────────────────
export interface Kit {
  id: string;
  name: string;
  description: string;
  photoURL?: string;
  itemIds: string[];
  status: ItemStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Reservation ──────────────────────────────────────────────────────
export type ReservationStatus =
  | 'pending'
  | 'approved'
  | 'checked_out'
  | 'completed'
  | 'cancelled';

export interface Reservation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemIds: string[];
  kitId?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: ReservationStatus;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Checkout ─────────────────────────────────────────────────────────
export type CheckoutStatus = 'active' | 'overdue' | 'returned';

export interface ConditionReport {
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
  photoURLs: string[];
  reportedAt: Timestamp;
  reportedBy: string;
}

export interface Checkout {
  id: string;
  reservationId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemIds: string[];
  checkedOutAt: Timestamp;
  dueDate: Timestamp;
  returnedAt?: Timestamp;
  status: CheckoutStatus;
  checkoutCondition?: ConditionReport;
  returnCondition?: ConditionReport;
  signatureURL?: string;
  notes?: string;
}

// ── Flag ─────────────────────────────────────────────────────────────
export type FlagType = 'damaged' | 'missing' | 'dirty' | 'needs_repair' | 'other';

export interface Flag {
  id: string;
  itemId: string;
  flaggedBy: string;
  flaggedByName: string;
  type: FlagType;
  description: string;
  photoURLs: string[];
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
}

// ── Audit Log ────────────────────────────────────────────────────────
export type AuditAction =
  | 'checkout'
  | 'checkin'
  | 'reserve'
  | 'cancel_reservation'
  | 'flag'
  | 'resolve_flag'
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'create_kit'
  | 'update_kit'
  | 'delete_kit';

export interface AuditLog {
  id: string;
  action: AuditAction;
  performedBy: string;
  performedByName: string;
  targetType: 'item' | 'kit' | 'reservation' | 'checkout' | 'flag';
  targetId: string;
  targetName: string;
  timestamp: Timestamp;
  details?: Record<string, string>;
}
