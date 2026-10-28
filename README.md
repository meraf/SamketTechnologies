# Samket Technologies (Vite + React + Tailwind)
**Dev:** `npm install && node server.js` (terminal 1), `npm run dev` (terminal 2). **Production:** `npm run build && SYNC_KEY=secret node server.js`, or `SYNC_KEY=secret docker compose up -d` (set your domain in `Caddyfile`).
Staff PINs (change in Staff > Sync): cashier 1111, technician 2222, master 9999. Sync key default `samket`.

**Structure:** `src/db.js` (IndexedDB, sync, conflicts, stock/units, notifications) · `src/ui.jsx` (components, roles, tracker timeline, scanner, print gate, thermal slip) · `src/App.jsx` (router, layouts, theme, sync indicator, login) · `src/pages/` Store, Track, Pos, Inventory, Repairs, Crm, Claims, Cash, Reports, Sync · `server.js` (sync API, public catalogue, ticket tracking) · `public/sw.js` (offline cache).
**Data:** serialized units are `unit` records (`itemId, serial, status, cost, soldDate`); a sale locks the unit and sets its warranty date. Two devices editing the same record trigger the review screen (Staff > Sync). Camera scanning uses the browser BarcodeDetector (Chrome/Android); USB scanners work as keyboards.

## Update notes
Roles: **admin** (PIN 9999) and **cashier** (PIN 1111); staff sign in only at `/staff`. Customer pages: `/`, `/shop`, `/contact`, `/repair` (repair portal), `/purchases` (sold-item portal). Staff repairs: `/staff/repairs/new` and `/staff/repairs` (tap steps 1-5; step 4 asks price and parts cost, step 5 asks warranty days then offers print).
**Printing:** default paper is A4 with a 3x3 grid of 68x96 mm cells from the top-left corner; pick the cell (1-9) so a partly used sheet can be reused. Each slip has a tear-off tag for the device. 58/80 mm thermal also available.
**Telegram:** copy `.env.example` to `.env`. Messaging uses the Bot API: create a bot with @BotFather, set `TG_BOT_TOKEN` and `TG_BOT_USERNAME` (and `TG_STAFF_CHAT` for new-request alerts). Customers tap "Get updates on Telegram" on their ticket to link their chat. `TG_API_ID` / `TG_API_HASH` are kept server-side only; they are for user-account (MTProto) clients and are not needed for bot messages.
