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
- Click **+ Add to basket** on any item to collect it as you browse — see *The Basket* below.
- Click any item to open its **detail page**, which shows its current status, condition history, and full audit trail.

### Kits

The **Kits** screen lists named bundles of related equipment (e.g. "Camera Kit A"). Kits can be reserved or checked out as a group.

---

## The Basket

The **Basket** lets you gather gear while you browse and decide what to do with it afterwards, rather than choosing between a reservation and a checkout before you start.

- Add anything from the **Items** screen with **+ Add to basket**. The button changes to **In basket**, and a count appears beside **Basket** in the sidebar.
- Click **Basket** to open it. You can remove items one at a time, or empty it completely.
- From there, pick one of two things:
  - **Reserve for later** — takes everything in the basket through to a new reservation, with the items already selected.
  - **Check out now** — takes only the items that are free right now through to a new checkout.

Gear that is currently out on loan **can** still go in your basket. It can't be taken today, but it can be booked for a future date, so the basket tells you how many items are out and **Check out now** only ever takes the ones actually available. Anything flagged as **Damaged** or **Needs Investigating**, or in a category your organisation has marked as not bookable, can't be added at all.

Your basket is private to you and stored in your own browser, so it survives closing the tab and coming back to it later. Signing out clears it. Once you've booked something, it leaves the basket on its own.

> **The basket does not hold or reserve anything.** Nobody else can see it, and everything in it stays bookable by everyone until you actually book it. If a colleague checks something out while it's sitting in your basket, the basket updates to show it's gone.

---

## Reservations

### Creating a Reservation (all roles)

1. Go to **Reservations** and click **New Reservation**.
2. Select the items or kits you need. Use the **search box** or the **category dropdown** above the list to narrow a long inventory down. (If you arrived here from your basket, they're already selected.)
3. Choose a **start date** and **end date**.
4. Choose the **Booking type** — **Work** or **Personal** (see *Personal Bookings* below).
5. Submit. A **Work** booking made by a **User** is created **Pending** and needs a manager's approval; a **Manager** or **Admin** booking one is **approved automatically**. A **Personal** booking is always **Pending** until an admin decides, whoever raised it.

The system will warn you if:
- Your chosen dates conflict with an existing approved reservation.
- Any selected item is currently flagged for inspection.

### Reservation Statuses

| Status | Meaning |
|---|---|
| Pending | Awaiting approval — a work booking made by a User, or any personal booking |
| Approved | Approved and ready for checkout |
| Checked Out | Gear has been taken out against this reservation |
| Completed | Gear has been returned |
| Cancelled | Reservation was cancelled by a manager |
| Declined | A personal booking an admin turned down, or that nobody decided in time |

### Approving / Cancelling Reservations (Manager+)

Managers see all pending reservations on the **Reservations** screen and can **Approve** or **Cancel** them from there. Personal bookings are the exception — only an admin can decide those.

### Personal Bookings

Booking gear ahead for your own use works the same way as a personal checkout, but for dates in the future. On the **New Reservation** form, switch the **Booking type** from **Work** to **Personal**.

1. Choose **Personal** and give a short **reason** — this is shown to the admin who decides.
2. Pick your dates and items as normal.
3. Accept both **declarations**: that you have checked the gear isn't needed for business use over those dates, and that you accept liability for the £1000 excess. Both are recorded against the booking with the date you accepted them.
4. Submit. The booking is held as **Pending** and the organisation's admins are emailed.

While a personal booking is awaiting a decision, its items and dates are locked so the admin decides on exactly what you submitted — you can still edit the notes, or cancel the request outright. Nobody else can book those dates in the meantime.

Once approved, the gear is checked out to you automatically at the start time — you don't need to do anything else — and it appears as a personal checkout, due back on your end date.

**If nobody decides**, the booking is **declined automatically 30 minutes before it was due to start**, and you're emailed to say so. This is deliberate: it means you find out before you turn up expecting gear, rather than discovering it silently never happened.

**For admins:** pending personal bookings appear in a banner at the top of the **Reservations** screen and under the **Pending** filter. Only admins can approve or decline them — managers see the request but have no buttons. Approving or declining emails the requester either way, and a booking still undecided a day after it was raised sends admins a reminder. Every decision is recorded, including who made it, and appears in **Reports → Personal**.

A personal booking cannot be raised on someone else's behalf — the declarations are a personal liability acceptance, so the **Assign To** option is hidden for personal bookings.

---

## Checkouts

### Checking Out Gear (Manager+)

1. Go to **Checkouts** and click **New Checkout**.
2. Select the items and the **due date** — the **category dropdown** beside the search box narrows the list, and anything sent through from your basket is already ticked. The checkout is recorded under your own account — there's currently no way to check gear out on someone else's behalf. If it's for a teammate, they should grab it themselves (Quick Grab or the mobile app).
3. Optionally add a **condition report** (rating and notes) at checkout time.
4. Confirm — the items are marked as **Checked Out** and are no longer available for others to book.

> Managers can also create a checkout directly from an approved reservation.

### Quick Grab

**Quick Grab** is a fast checkout for end-of-day loans where gear is expected back the same day. It skips the full checkout form. Quick Grab is for work use only — personal loans always go through the full form so they can be approved.

### Personal Checkouts

If you're taking something home for your own use rather than for work, switch the **Checkout type** at the top of the New Checkout form from **Work** to **Personal**.

1. Choose **Personal** and give a short **reason** — this is shown to the admin who decides.
2. Pick the items and a due date.
3. Read and tick **both declarations** — one confirming you've checked the equipment isn't needed for business use, and one accepting responsibility for safe use and the £1000 excess in the event of loss or damage. The request button stays disabled until both are ticked, and no approval email is sent without them.
4. Click **Request approval**.
5. The gear is held for you straight away, so nobody else can book it, but **don't take it yet** — it shows as *Awaiting Approval* until an admin decides.
6. An admin is emailed automatically. When they approve or decline, you get an email back, and the status updates on both the website and the mobile app.

If you change your mind before a decision is made, use **Withdraw** to cancel the request and put the gear straight back into the pool.

**For admins:** pending requests appear in a banner at the top of the **Checkouts** screen and under the **Awaiting approval** filter. Only admins can approve or decline — managers cannot. The approval email confirms the requester accepted both declarations. Declining releases the gear immediately and emails the requester your reason. Every decision is recorded, including who approved it, and appears in **Reports → Personal**.

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

- **Reservation requested** — admins and managers receive an email when a reservation is waiting for approval. A **personal** booking goes to admins only, since managers can't authorise one.
- **Reservation approved** — the requester receives an email when their reservation is approved.
- **Personal booking declined** — the requester is emailed when an admin declines their booking, with the reason. If it lapsed with no decision, the email says so and the org's admins are copied.
- **Personal booking still waiting** — admins are reminded about a personal booking still undecided a day after it was raised.
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

> The basket is part of the main app rather than the mobile app. On a phone you'll find it in the top bar when using the full site; the `/m` mobile app doesn't have it.

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
- A personal register showing what's out personally now, what's booked ahead but not yet collected, what's awaiting approval, and who authorised each one

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

**Does putting something in my basket reserve it?**
No. The basket is a private shopping list in your own browser — it places no hold on anything, and nobody else can see it. Items in your basket stay available to everyone until you actually reserve or check them out. If someone books one first, you'll be told when you try to take it.

**Why can't I add an item to my basket?**
Items flagged as **Damaged** or **Needs Investigating** can't be added, and neither can items in a category your organisation has marked as not bookable. Gear that's simply out on loan *can* be added — you just can't check it out today, only book it for later.

**Why did an old checkout or reservation disappear?**
GearTrack clears out checkout and reservation records older than 180 days to keep things tidy. Personal checkout records are kept for 2 years. Your current and recent history isn't affected — only old, completed records are removed.

**How do I get an account?**
There's no sign-up form — ask your organisation's Admin to add you from the Admin Panel. You'll get a one-time link to set your password.
