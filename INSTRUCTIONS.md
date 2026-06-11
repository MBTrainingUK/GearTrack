# GearTrack — User Instructions

GearTrack is an equipment management system for tracking gear checkouts, reservations, and condition reporting. It supports three user roles — **User**, **Manager**, and **Admin** — each with different levels of access.

---

## Getting Started

### Creating an Account

1. Navigate to the app and click **Register**.
2. Enter your name, email address, and a password.
3. Your account is created with **User** role by default. An Admin can upgrade your role if needed.

### Logging In

1. Enter your email and password on the **Login** screen.
2. You are taken to the Dashboard on successful login.

---

## The Dashboard

The Dashboard gives a live overview of the inventory:

- **Summary cards** — total items, available items, checked-out items, and overdue items.
- **7-day activity chart** — a bar chart of recent checkout and return activity.
- **Upcoming reservations** — a calendar view of approved reservations due in the coming days.

---

## Browsing Inventory

### Items

The **Items** screen lists all equipment in the system.

- Use the **search bar** to find items by name.
- Filter by **category** or **condition** using the dropdowns.
- Click any item to open its **detail page**, which shows its current status, condition history, photos, and full audit trail.

### Kits

The **Kits** screen lists named bundles of related equipment (e.g. "Camera Kit A"). Kits can be reserved or checked out as a group.

---

## Reservations

### Creating a Reservation (all roles)

1. Go to **Reservations** and click **New Reservation**.
2. Select the items or kits you need.
3. Choose a **start date** and **end date**.
4. Submit — the reservation is created with a **Pending** status.

The system will warn you if:
- Your chosen dates conflict with an existing approved reservation.
- Any selected item is currently flagged for inspection.

### Reservation Statuses

| Status | Meaning |
|---|---|
| Pending | Awaiting manager approval |
| Approved | Approved and ready for checkout |
| Checked Out | Gear has been taken out against this reservation |
| Completed | Gear has been returned |
| Cancelled | Reservation was cancelled by a manager |

### Approving / Cancelling Reservations (Manager+)

Managers see all pending reservations on the **Reservations** screen and can **Approve** or **Cancel** them from there.

---

## Checkouts

### Checking Out Gear (Manager+)

1. Go to **Checkouts** and click **New Checkout**.
2. Select the user taking the gear, the items, and the **due date**.
3. Optionally add a **condition report** (rating and notes) and photos at checkout time.
4. Confirm — the items are marked as **Checked Out** and are no longer available for others to book.

> Managers can also create a checkout directly from an approved reservation.

### Quick Grab

**Quick Grab** is a fast checkout for end-of-day loans where gear is expected back the same day. It skips the full checkout form.

### Returning Gear (Check-In)

1. Open the active checkout from the **Checkouts** screen.
2. Click **Return** (or **Check In**).
3. Log the return condition — rate the condition (Excellent / Good / Fair / Poor / Damaged) and add any notes or photos.
4. Confirm — the items return to **Available** status.

> If an item is returned in **Poor** or **Damaged** condition, it is automatically **flagged** for inspection and cannot be reserved again until the flag is cleared.

### Overdue Items

An item is considered overdue when its checkout due date has passed and it has not yet been returned. Overdue checkouts are highlighted on the Checkouts screen.

---

## My History

The **My History** screen shows your personal record of past and current checkouts and reservations. Use this to track what you currently have out and review your previous borrowing history.

---

## Mobile App

GearTrack includes a **mobile-optimised PWA** accessible at the `/m/` path (or via a mobile shortcut).

### My Gear (mobile)

Shows all items you currently have checked out, with their due dates and return status. Tapping **Return** opens a condition report — select the condition (Excellent / Good / Fair / Poor / Damaged) and add any notes before confirming. Items returned in Poor or Damaged condition are automatically flagged for inspection.

### Browse (mobile)

A searchable list of all inventory. You can initiate a reservation or checkout directly from a mobile device.

---

## Manager Features

### Managing Items

Managers can **add**, **edit**, and **delete** inventory items from the **Items** screen.

**When adding an item:**
- Enter the name, category, serial number, and asset number.
- Upload one or more photos.
- Set the current condition and optionally log a purchase date, price, and expected lifespan.

**Flagging an item:**
- Open the item detail page and use the **Flag for Inspection** action.
- Flagged items cannot be reserved until the flag is cleared.

### Activity Log

The **Activity Log** shows a full audit trail of every significant action in the system — checkouts, returns, reservation approvals, item changes, and user actions. Each entry records who performed the action and when.

---

## Admin Features

### User Management

Admins access the **Admin Panel** to manage user accounts.

- **Change role** — Promote or demote a user between User, Manager, and Admin. Note: Admins cannot change their own role.
- **Remove user** — Remove a user from the system.

### Reports

The **Reports** screen provides analytics across the inventory:

- Usage per item and per user
- Average checkout duration
- Late return rates
- Items that have never been checked out
- Reservation approval rates

---

## Role Summary

| Feature | User | Manager | Admin |
|---|:---:|:---:|:---:|
| Browse items & kits | ✓ | ✓ | ✓ |
| Create reservations | ✓ | ✓ | ✓ |
| View own history | ✓ | ✓ | ✓ |
| Mobile app | ✓ | ✓ | ✓ |
| Add / edit / delete items | | ✓ | ✓ |
| Approve / cancel reservations | | ✓ | ✓ |
| Create / manage checkouts | | ✓ | ✓ |
| View Activity Log | | ✓ | ✓ |
| View Reports | | | ✓ |
| Manage user roles | | | ✓ |

---

## Common Questions

**Why can't I reserve an item?**
The item may be flagged for inspection, already reserved for those dates, or currently checked out past its due date.

**Why is my reservation still Pending?**
Reservations require manager approval before they are confirmed. Contact your manager to review it.

**What happens if I return gear in poor condition?**
The item is automatically flagged for inspection. A manager must clear the flag before the item can be reserved again.

**Can I use GearTrack on my phone?**
Yes — open the app on a mobile browser and navigate to the Browse or My Gear section. You can add it to your home screen as a PWA for faster access.
