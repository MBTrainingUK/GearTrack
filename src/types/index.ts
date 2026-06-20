import { Timestamp } from 'firebase/firestore';

// ── Organization ─────────────────────────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: Timestamp;
  contactEmail?: string;
}

// ── User ─────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'manager' | 'user';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  orgId: string;
  // True only for platform-level operators who can see/manage every org.
  isPlatformAdmin?: boolean;
  photoURL?: string;
  createdAt: Timestamp;
}

// ── Item ─────────────────────────────────────────────────────────────
// Items are only ever 'available' or 'checked_out'. Condition concerns
// (attention_needed/damaged/etc.) are tracked separately on `Item.condition`.
export type ItemStatus = 'available' | 'checked_out';

export interface Item {
  id: string;
  orgId: string;
  name: string;
  description: string;
  category: string;
  serialNumber?: string;
  assetNumber?: string;
  condition?: 'good' | 'attention_needed' | 'needs_investigating' | 'damaged';
  conditionFlagNote?: string;
  status: ItemStatus;
  photoURLs: string[];
  location?: string;
  purchaseDate?: Timestamp;
  purchasePrice?: number;
  expectedLifespanMonths?: number;
  lifespanResetDate?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Kit ──────────────────────────────────────────────────────────────
export interface Kit {
  id: string;
  orgId: string;
  name: string;
  description: string;
  photoURL?: string;
  itemIds: string[];
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
  orgId: string;
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
  orgId: string;
  reservationId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemIds: string[];
  kitId?: string;
  checkedOutAt: Timestamp;
  dueDate: Timestamp;
  returnedAt?: Timestamp;
  status: CheckoutStatus;
  checkoutCondition?: ConditionReport;
  returnCondition?: ConditionReport;
  notes?: string;
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
  | 'delete_kit'
  | 'approve_reservation';

export interface AuditLog {
  id: string;
  orgId: string;
  action: AuditAction;
  performedBy: string;
  performedByName: string;
  targetType: 'item' | 'kit' | 'reservation' | 'checkout' | 'flag';
  targetId: string;
  targetName: string;
  timestamp: Timestamp;
  details?: Record<string, string>;
}
