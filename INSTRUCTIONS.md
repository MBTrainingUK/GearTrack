# GearTrack — User Instructions

GearTrack is an equipment management system for tracking gear checkouts, reservations, and condition reporting. It supports three user roles — **User**, **Manager** (shown as **Team Member** in the Admin Panel), and **Admin** — each with different levels of access.

---

## Getting Started

### Creating an Account

GearTrack doesn't have open sign-up — accounts are created by your organisation's Admin.

1. Ask your Admin to add you via the Admin Panel.
2. The Admin will send you a one-time **password-reset link** (by email, Slack, or however your team shares things — it isn't sent automatically).
3. Open the link, set your password, then sign in.
4. Your account starts with the **User** role by default. An Admin can upgrade your role if needed.

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
- Click any item to open its **detail page**, which shows its current status, condition history, and full audit trail.

### Kits

The **Kits** screen lists named bundles of related equipment (e.g. "Camera Kit A"). Kits can be reserved or checked out as a group.

---

## Reservations

### Creating a Reservation (all roles)

1. Go to **Reservations** and click **New Reservation**.
2. Select the items or kits you need.
3. Choose a **start date** and **end date**.
4. Submit. If you're a **User**, the reservation is created with a **Pending** status and needs a manager's approval. If you're a **Manager** or **Admin**, it's **approved automatically**.

The system will warn you if:
- Your chosen dates conflict with an existing approved reservation.
- Any selected item is currently flagged for inspection.

### Reservation Statuses

| Status | Meaning |
|---|---|
| Pending | Awaiting manager approval (only for reservations made by a User) |
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
2. Select the items and the **due date**. The checkout is recorded under your own account — there's currently no way to check gear out on someone else's behalf. If it's for a teammate, they should grab it themselves (Quick Grab or the mobile app).
3. Optionally add a **condition report** (rating and notes) at checkout time.
4. Confirm — the items are marked as **Checked Out** and are no longer available for others to book.

> Managers can also create a checkout directly from an approved reservation.

### Quick Grab

**Quick Grab** is a fast checkout for end-of-day loans where gear is expected back the same day. It skips the full checkout form.

### Returning Gear (Check-In)

1. Open the active checkout from the **Checkouts** screen.
2. Click **Return** (or **Check In**).
3. Log the return condition — rate the condition (Excellent / Good / Fair / Poor / Damaged) and add any notes.
4. Confirm — the items return to **Available** status.

> If an item is returned in **Poor** or **Damaged** condition, it is automatically **flagged** for inspection and cannot be reserved again until the flag is cleared.

### Overdue Items

An item is considered overdue when its checkout due date has passed and it has not yet been returned. Overdue checkouts are highlighted on the Checkouts screen.

---

## Email Notifications

GearTrack sends automatic emails so nothing slips through the cracks:

- **Reservation requested** — admins and managers receive an email when a reservation is waiting for approval.
- **Reservation approved** — the requester receives an email when their reservation is approved.
- **Due tomorrow** — borrowers receive a reminder the day before their gear is due back.
- **Overdue** — borrowers receive an alert once their gear becomes overdue, with the organisation's admins copied in. The subject line includes the borrower's name (e.g. *"Overdue: Sam Taylor — gear was due back Tue 14 Jul 2026"*), so a shared inbox shows at a glance who needs to return gear.

Reminders are sent once per checkout, each morning at 8am UK time. Overdue is counted by calendar day — an item due back today is not overdue until tomorrow morning, so same-day returns are never chased.

---

## My History

The **My History** screen shows your personal record of past and current checkouts and reservations. Use this to track what you currently have out and review your previous borrowing history.

---

## Mobile App

GearTrack includes a **mobile-optimised PWA** accessible at the `/m/` path (or via a mobile shortcut).

### My Gear (mobile)

Shows all items you currently have checked out, with their due dates and return status. Tapping **Return** opens a condition report — select the condition (Excellent / Good / Fair / Poor / Damaged) and add any notes before confirming. Items returned in Poor or Damaged condition are automatically flagged for inspection.

### Browse (mobile)

A searchable list of currently available items. Tap **Quick Grab** to check one out to yourself instantly, due back by end of today — there's no condition report or custom due date on this quick mobile flow. For reservations, or a full checkout with a custom due date and condition report, use the full site (it works fine in a mobile browser too, just outside this dedicated app view).

---

## Manager Features

### Managing Items

Managers can **add**, **edit**, and **delete** inventory items from the **Items** screen.

**When adding an item:**
- Enter the name, category, serial number, and asset number.
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

- **Add user** — Create a new teammate's account. GearTrack generates a one-time password-reset link for you to share with them manually (there's no automated email).
- **Change role** — Promote or demote a user between User, Manager, and Admin (shown as "Team Member" in the picker). Note: Admins cannot change their own role.
- **Remove user** — Remove a user from the system.

### Backup & Restore

The Admin Panel has an **Export/Import** section for the inventory catalogue:

- **Export** downloads a JSON file of every item and kit in your organisation.
- **Import** reads that file back in and restores items/kits, overwriting any that already exist.

This covers items and kits only — it doesn't include reservations, checkouts, the Activity Log, or user accounts.

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
| Add / remove users & manage roles | | | ✓ |

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

**Why did an old checkout or reservation disappear?**
GearTrack clears out checkout and reservation records older than 180 days to keep things tidy. Your current and recent history isn't affected — only old, completed records are removed.

**How do I get an account?**
There's no sign-up form — ask your organisation's Admin to add you from the Admin Panel. You'll get a one-time link to set your password.
