# GearTrack

Multi-tenant equipment management system for tracking gear checkouts, reservations, and condition reporting.

Built for media and AV environments where kit needs to be signed out, tracked, and returned in good condition. A single deployment can serve multiple separate organisations, each with its own fully isolated inventory, users, and history.

---

## Features

- **Inventory management** — add items with serial numbers, asset numbers, categories, custom fields, and dropdown filters
- **Kits** — group items into named kits that can be reserved and checked out together, and edited in place rather than rebuilt
- **Reservations** — book equipment for a date range, with approval workflow and a calendar view
- **Checkouts** — sign gear out with a condition report; Quick Grab for instant end-of-day loans
- **Check-in** — log return condition; damaged or flagged-for-investigation returns block re-booking until cleared
- **Mobile PWA** — installable mobile experience (`/m`) for browsing inventory and managing "My Gear" on the go
- **Dashboard** — live overview of available/checked-out/overdue items, 7-day activity chart, and a calendar of upcoming reservations
- **Reports** — usage analytics per item and per user, checkout duration, late-return rate, unused items, equipment lifespan/inspection tracking, and cost-per-checkout financials
- **Activity log** — full audit trail of who did what, when
- **Admin panel** — manage user roles, add new teammates, and run data maintenance
- **Email notifications** — managers are emailed when a reservation needs approval, requesters when it's approved, and borrowers get due-tomorrow reminders and overdue alerts (overdue alerts CC the org's admins)
- **Backup & restore** — export an organisation's items and kits to a JSON file, and re-import to restore
- **Date-range filtering & retention** — 30/90-day filters on reservations, checkouts, and history; records older than 180 days are automatically purged

## Multi-tenancy

GearTrack is built so one deployment can host several separate customer organisations on a shared database, with strict data isolation between them:

- Every record (items, kits, checkouts, reservations, users, audit log) belongs to exactly one **organisation** (`orgId`), enforced server-side by Firestore Security Rules — not just by application logic. A query that isn't provably scoped to the requesting user's own organisation is rejected by the database outright.
- There is no open self-registration. Accounts are created only by an organisation's own admin (Admin Panel → **Add user**) or by the platform admin (creating a brand-new organisation via the **Organizations** console). New accounts are activated through a single-use password-reset link.
- A **platform admin** (a Firebase custom claim, `platformAdmin: true`) can see and manage every organisation, for onboarding new customers and providing support.

See [`legal/DPA.md`](./legal/DPA.md) for the data-processing terms this implies for customers, and [`legal/INCIDENT_RESPONSE_PLAN.md`](./legal/INCIDENT_RESPONSE_PLAN.md) for the operational playbook.

## Roles

| Role | Permissions |
|---|---|
| **User** | Browse inventory, make reservations, manage their own checkouts |
| **Manager** ("Team Member") | All of the above, plus create/edit items and kits, manage all checkouts and check-ins |
| **Admin** | Full access within their own organisation, including Reports, Activity Log, and Admin Panel (add users, manage roles, data maintenance) |
| **Platform Admin** | Cross-organisation access: the Organizations console (create new customer organisations), plus full access to every organisation's data for support |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand (shared items/categories stores) |
| Backend / DB | Firebase (Firestore, Authentication) |
| Server-side logic | Firebase Cloud Functions (TypeScript, Node 20) — organisation/user provisioning |
| Charts & calendar | Recharts, FullCalendar |
| Routing | React Router v7 |
| Mobile | Vite PWA plugin |
| Deployment | GitHub Pages, via GitHub Actions on every push to `main` |

> Firebase Storage is configured (`storage.rules`) but currently unused — the photo-upload feature it backed has been removed from the app.

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project on the **Blaze** plan (required for Cloud Functions) with Firestore and Authentication (Email/Password) enabled

### Setup

1. Clone the repo

```bash
git clone https://github.com/MBTrainingUK/GearTrack.git
cd GearTrack
```

2. Install dependencies

```bash
npm install
cd functions && npm install && cd ..
```

3. Create a `.env.local` file in the project root with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. Deploy Firestore rules, indexes, and Cloud Functions:

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

5. Bootstrap the first organisation and platform admin: sign up your first user the old way (or create one directly in Firebase Console), then call the one-time `backfillDefaultOrg` Cloud Function as that user — it creates a default organisation, migrates any existing users into it, and promotes the caller to platform admin. It self-disables once any organisation exists.

6. Start the dev server

```bash
npm run dev
```

### Email notifications

Notification emails are sent by Cloud Functions via [Resend](https://resend.com):

1. Create a Resend account, verify the sending domain, and generate an API key per Firebase project.
2. Store each key as a Firebase secret: `firebase functions:secrets:set RESEND_API_KEY --project <project>`
3. Per-environment settings live in `functions/.env.<projectId>`:
   - `MAIL_FROM` — sender address (must be on a Resend-verified domain in production)
   - `APP_URL` — base URL used for links in emails
   - `MAIL_REDIRECT` — staging only: redirects every email to this address so real users are never emailed from staging

Three functions do the sending: `onReservationCreated` (pending reservation → org admins/managers), `onReservationUpdated` (approved → requester), and `sendDueDateEmails` (daily at 08:00 UK time: due-tomorrow reminders, plus overdue alerts CC'd to org admins, with the borrower's name in the subject line for shared inboxes). Reminder emails are stamped on the checkout doc (`dueSoonEmailAt`/`overdueEmailAt`) so each is sent at most once. Overdue is derived at calendar-day level, matching `src/lib/checkout.ts`.

> Until a sending domain is verified in Resend, the `onboarding@resend.dev` test sender can only deliver to the Resend account owner's own address — verify a domain before going to production.

### Deploy

Pushing to `main` triggers the `Deploy to GitHub Pages` GitHub Actions workflow, which builds the project and publishes `dist` to GitHub Pages. Cloud Functions and Firestore rules/indexes are **not** part of that workflow — deploy them manually with `firebase deploy` when changed.

### Backup & Restore

The Admin Panel has an Export/Import section for items and kits, scoped to the signed-in admin's own organisation:

- **Export** downloads a `geartrack-backup-<date>.json` file containing every item and kit in that organisation (metadata only).
- **Import** reads that file back in and restores items/kits by ID, overwriting any that already exist.

This does not cover reservations, checkouts, the audit log, or users — only inventory data.

Separately, the underlying Firestore database has a **native daily backup schedule** (7-day retention) for disaster recovery — see `firebase firestore:backups:schedules:list`.

## Firestore Structure

```
organizations/  — one doc per customer organisation
users/          — user profiles, roles, and orgId (created only via Cloud Functions)
items/          — inventory items (orgId-scoped)
categories/     — item categories (orgId-scoped)
kits/           — named groups of items (orgId-scoped)
reservations/   — date-range bookings (orgId-scoped)
checkouts/      — active and historical checkouts with condition reports (orgId-scoped)
auditLog/       — action history (orgId-scoped)
```

## Firestore Security Rules

Rules are defined in `firestore.rules` and are organisation-aware: every collection (other than `organizations` itself) checks that the requesting user's `orgId` custom claim matches the document's `orgId`, with an unconditional bypass for platform admins. Storage rules are in `storage.rules` but currently guard no live data (see Tech Stack note above).

## Compliance & Operations

The `legal/` folder contains drafts of:

- [`PRIVACY_POLICY.md`](./legal/PRIVACY_POLICY.md) — end-user-facing privacy policy
- [`DPA.md`](./legal/DPA.md) — Controller/Processor data processing agreement for customers
- [`INCIDENT_RESPONSE_PLAN.md`](./legal/INCIDENT_RESPONSE_PLAN.md) — internal breach/incident playbook

The privacy policy and DPA need a solicitor's review and the bracketed placeholders filled in before use with a paying customer.

## Licence

MIT
