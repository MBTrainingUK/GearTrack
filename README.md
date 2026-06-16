# GearTrack

Equipment management system for tracking gear checkouts, reservations, and condition reporting.

Built for media and AV environments where kit needs to be signed out, tracked, and returned in good condition.

---

## Features

- **Inventory management** — add items with photos, serial numbers, asset numbers, categories, and custom fields
- **Kits** — group items into named kits that can be reserved and checked out together
- **Reservations** — book equipment for a date range, with approval workflow
- **Checkouts** — sign gear out with a condition report; Quick Grab for instant end-of-day loans
- **Check-in** — log return condition; poor or damaged returns automatically flag the item for inspection
- **Dashboard** — live overview of available/checked-out/overdue items, 7-day activity chart, and upcoming reservations
- **Reports** — usage analytics per item and per user, checkout duration, late return rate, and unused items
- **Admin panel** — manage user roles and access
- **Backup & restore** — export all items and kits to a JSON file, and re-import it to restore your inventory

## Roles

| Role | Permissions |
|---|---|
| **User** | Browse inventory, make reservations |
| **Manager** | All of the above, plus create/edit items, manage checkouts and check-ins |
| **Admin** | Full access, including Reports and Admin Panel |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Backend / DB | Firebase (Firestore, Auth, Storage) |
| Charts | Recharts |
| Routing | React Router v7 |
| Deployment | GitHub Pages via gh-pages |

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore, Authentication (Email/Password), and Storage enabled

### Setup

1. Clone the repo

```bash
git clone https://github.com/MBTrainingUK/GearTrack.git
cd GearTrack
```

2. Install dependencies

```bash
npm install
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

4. Start the dev server

```bash
npm run dev
```

### Deploy

Pushing to `main` triggers the `Deploy to GitHub Pages` GitHub Actions workflow, which builds the project and publishes `dist` to GitHub Pages.

### Backup & Restore

The Admin Panel has an Export/Import section for items and kits:

- **Export** downloads a `geartrack-backup-<date>.json` file containing every item and kit (excluding photo files themselves — only metadata is included).
- **Import** reads that file back in and restores items/kits by ID, overwriting any that already exist.

This does not cover reservations, checkouts, the audit log, or users — only the inventory data (items and kits).

## Firestore Structure

```
items/          — inventory items
kits/           — named groups of items
reservations/   — date-range bookings
checkouts/      — active and historical checkouts with condition reports
users/          — user profiles and roles
flags/          — item condition flags
auditLogs/      — action history
```

## Firestore Security Rules

Rules are defined in `firestore.rules`. Storage rules are in `storage.rules`. Review and tighten these before going to production.

## Licence

MIT
