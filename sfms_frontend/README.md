# Smart Franchise Management System — Frontend

React frontend connecting to your Django backend. Includes Module 1 (Auth & Outlet Onboarding) and Module 3 (Sales Entry & Analytics).

## Design system

The UI follows a distinctive "ledger / operations-room" visual identity grounded in the F&B franchise world:
- **Colors:** deep teal (brand), warm amber (accent), charcoal sidebar, warm paper-white background
- **Type:** Space Grotesk (headings), Inter (body), IBM Plex Mono (all numbers — sales figures, dates)
- **Signature element:** stat cards styled like small printed tickets/receipts

All design tokens live in `src/index.css` as CSS variables (`--teal`, `--amber`, `--charcoal`, etc.) — change them there to re-theme the whole app.

## What's included

- **Login / Register** — split-screen design with a live ticker preview
- **Franchise Owner Dashboard:**
  - Outlet onboarding form (if no outlet yet) with live approval status
  - Sales stat cards (today, this month, average daily, growth %)
  - Sales trend line chart
  - Quick sales-entry form
  - Recent entries table
- **Admin Dashboard:**
  - Network-wide stat cards (today, this month, pending approvals, avg growth)
  - Bar chart comparing sales across all outlets
  - Outlet approval table (Approve/Reject)

## IMPORTANT: Run the backend FIRST

```bash
cd sfms_backend
python manage.py runserver
```
Keep that terminal open.

## How to run this frontend

Open a **NEW, separate** terminal window:

```bash
cd sfms_frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

## How to test the full flow

1. Register a fake franchise owner → login → submit outlet details
2. Logout → login as Admin (`admin` / `Admin@12345`) → Approve the outlet
3. Logout → login as the owner again → you'll now see the Sales section
4. Log a few days of sales (you can backdate using the API directly, or just log "today" a few times on different days) → watch the chart and stats update
5. Logout → login as Admin → see that outlet's sales in the network comparison chart

## Folder structure

```
src/
├── api/api.js                     # All API calls to Django backend
├── context/AuthContext.jsx        # Tracks logged-in user across the app
├── components/
│   ├── DashboardLayout.jsx        # Shared sidebar shell for Owner/Admin dashboards
│   ├── StatTicket.jsx             # Signature ticket-style stat card
│   └── Badge.jsx                  # Status pill (pending/approved/rejected)
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── OwnerDashboard.jsx
│   └── AdminDashboard.jsx
├── index.css                      # Design system tokens (colors, fonts, shadows)
└── App.jsx                        # Routing setup
```

## Common issues

- **"Network Error" when logging in** → Django backend isn't running. Start it first.
- **Charts appear blank on first load** → Already fixed (Recharts animation was disabled for reliable rendering). If you still see this, hard-refresh the page.
- **CORS error in browser console** → Make sure `CORS_ALLOWED_ORIGINS` in Django's `settings.py` includes `http://localhost:5173` (already configured).
- **Blank white page** → Open browser console (F12), check for red error text, send it to me.
