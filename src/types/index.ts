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
// 'pending_approval' and 'declined' only ever apply to personal checkouts.
export type CheckoutStatus =
  | 'pending_approval'
  | 'active'
  | 'overdue'
  | 'returned'
  | 'declined';

// Personal = taken home, unrelated to work, and requires admin authorisation.
export type CheckoutType = 'work' | 'personal';

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
  // Absent on every checkout created before personal checkouts existed, so
  // consumers must read it via isPersonal() rather than comparing directly.
  type?: CheckoutType;
  personalReason?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  declinedBy?: string;
  declinedByName?: string;
  declinedAt?: Timestamp;
  declineReason?: string;
  checkoutCondition?: ConditionReport;
  returnCondition?: ConditionReport;
  notes?: string;
  // Stamped by the sendDueDateEmails Cloud Function so each reminder is
  // sent at most once per checkout.
  dueSoonEmailAt?: Timestamp;
  overdueEmailAt?: Timestamp;
  approvalReminderEmailAt?: Timestamp;
}

// ── Audit Log ────────────────────────────────────────────────────────
export type AuditAction =
  | 'checkout'
  | 'checkin'
  | 'request_personal_checkout'
  | 'approve_personal_checkout'
  | 'decline_personal_checkout'
  | 'cancel_personal_checkout'
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
  | 'approve_reservation'
  | 'edit_reservation';

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
