# Samket Technologies (Vite + React + Tailwind + Postgres)

One codebase, two installable apps (customers and staff), one shared cloud database.

## 1. Set up (5 minutes)

1. Create a free Postgres on **Neon** or **Supabase** and copy its connection string.
2. `cp .env.example .env` and fill in `DATABASE_URL`, `SYNC_KEY`, `SESSION_SECRET`.
3. `npm install`
4. `npm run db:init` (creates the tables; the server also does this automatically on first start).
5. Import your old data once (optional): `npm run db:migrate path/to/data.json`
6. Run: `node server.js` (terminal 1) and `npm run dev` (terminal 2) → http://localhost:5173
   Production on your own server: `npm run build && node server.js`, or `docker compose up -d` (set your domain in `Caddyfile`).

### Deploy on Vercel
1. Import the repo. Framework: Vite (auto-detected).
2. Settings → Environment Variables: add `DATABASE_URL`, `SYNC_KEY`, `SESSION_SECRET` (and the `TG_*` values if you use Telegram).
3. Deploy. `api/[...path].js` is the serverless function for every `/api/*` route; it uses the same database as localhost, so phones, laptops, localhost and Vercel all see the same data.
4. Telegram on Vercel uses a webhook, see the comment in `.env.example`.

Use the **pooled** connection string on Vercel (Neon: host contains `-pooler`; Supabase: port 6543).

## 2. What changed

| Issue | Where |
|---|---|
| 1 Central database | `lib/db.js`, `lib/store.js`, `lib/handler.js`, `api/[...path].js`, `server.js`, `scripts/` |
| 2 "Unfixed" + edit | `src/ui.jsx` (`STATUSES`, `StatusTag`, `Timeline`, `EditModal`), `src/pages/Repairs.jsx`, `Crm.jsx`, `Claims.jsx`, `PATCH/PUT /api/docs/:id` |
| 3 Cart + serials | `src/pages/Pos.jsx`, `saleSlip`/`Gate` in `src/ui.jsx` |
| 4 Sync hidden from cashiers | `src/App.jsx` (`admin` check), `ROLES` in `src/ui.jsx`, guard in `Sync.jsx` |
| 5 Phone login / linking | `/api/auth/check-phone`, `/api/auth/access`, `/api/req`, `/api/my` in `lib/handler.js`; `src/PhoneAuth.jsx`; `src/pages/Track.jsx` |
| 6 Two manifests | `public/manifest-client.json`, `public/manifest-staff.json`, `index.html`, `src/pwa.jsx` |
| 7 Offline-first | `src/sw.js` (Workbox via `vite-plugin-pwa`), `src/offline.js` (IndexedDB via `idb`), `src/db.js` |

### Behaviour notes
- **Phone numbers** are normalised (`0924598198` = `+251924598198` = `251924598198`), so history links to one customer.
  - *Known + password:* password required; new activity joins the existing history.
  - *Known, no password:* the customer may set one to claim the history; no "wrong password" error.
  - *New number:* profile created, password optional.
- **Unfixed** is the 6th status (red ✕ on the timeline). It asks for a diagnosis fee and a reason, prints a slip, messages the customer, counts in Cash/Reports as closed.
- **Edit**: tickets (all fields incl. status), customers, receipt details, claim description. Online it sends `PATCH /api/docs/:id`; offline it is saved locally and synced later (a conflicting edit from another device goes to the Sync review screen).
- **Cart**: Qty 3 shows *Serial Number #1…#3*; tracked stock can be multi-selected; one receipt for the whole cart (a big cart prints on a full A4 page instead of one 1/9 cell).
- **Sync visibility**: sync always runs silently for staff. Only admins see the indicator and the Sync page. On a cashier device that needs a different server/sync key use *Device settings* on the staff login screen.
- **Two PWAs**: customers install from `/` (opens `/`), staff install from `/staff/login` (opens `/staff/login`). They have different manifest `id`s, so both can be installed side by side.
- **Offline**: pages and assets are precached (they open with no network). Records are written to IndexedDB first and synced when online. Other calls (customer requests, Telegram notices) go to an IndexedDB outbox and are replayed automatically, also by Background Sync on Chrome/Android when the app is closed.

## 3. Staff, printing, numbering (unchanged)
Roles: **admin** (PIN 9999) and **cashier** (PIN 1111), change PINs in Staff → Sync. Customer pages: `/`, `/shop`, `/contact`, `/repair`, `/purchases`. Staff sign in at `/staff/login`.
Printing: default A4 with a 3×3 grid of 68×96 mm cells (pick the cell 1-9), 58/80 mm thermal also available.
Numbering: sales `SL-n`, repairs `R-n`, phones `P-n`, laptops `L-n` (D, M, PT, AC for desktops, modems, parts, accessories).
Camera scanning uses the browser BarcodeDetector (Chrome/Android); USB scanners work as keyboards.

## 4. Security notes
- Change `SYNC_KEY`; the default `samket` is public. Staff devices send it as `x-key`.
- PINs are still checked in the browser (as before). For real protection add server-side staff login.
- Customers who forget their password need a staff reset (delete their row in the `users` table).
- Never commit `.env` or `data.json` (customer data). Both are in `.gitignore`.

## Why a second phone showed no data (fixed)
Staff devices sync through `/api/sync`, which needs the same key as `SYNC_KEY` in Vercel. A device without that key got 401 and the app hid the error. Now the sign-in screen asks for the key once per device, the header shows "Wrong sync key" or "Cannot reach server" for every role, and Staff > Sync has "Re-download all".
