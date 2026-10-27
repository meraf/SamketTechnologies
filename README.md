# Samket Technologies
Storefront (`/`) + shop app (`/admin.html`, PIN 1234, installable on any phone/PC as an app).

**Run:** `node server.js` (Node 18+), open http://localhost:3000. Set `SYNC_KEY` and change the PIN in Settings.
**Other devices:** host this folder on an HTTPS server (VPS + Caddy, or Cloudflare Tunnel). Service workers need HTTPS except on localhost. In Settings on each device, set the server URL and key.

**Offline & conflicts:** every device keeps a full IndexedDB copy and works with no internet. Stock is the sum of append-only movements (sales/receipts), so two offline devices selling the same item merge correctly; edits to items/tickets are last-write-wins per record; ticket and receipt codes include the device ID so they never clash. Sync runs every 20 s and on reconnect.

**Edit:** shop phone, address, hours and testimonials at the top of `public/index.html`. Data lives in `data.json` (back it up).

**Also included:** item photos (shown on the storefront), sales history with profit, receipt search and per-item warranty status, refunds that return items to stock, discount and payment method on sales, low-stock banner on every tab, delete items, and JSON backup/restore (Settings).

## Deploy on a server (HTTPS, automatic certificate)
1. Get a VPS with Docker and point your domain's DNS A record to it.
2. Put your domain in `Caddyfile`, then run: `SYNC_KEY=your-secret docker compose up -d`
3. Open `https://yourdomain.com`, go to Staff, and in Settings set the same sync key and a new PIN on every device.
Data is kept in `./data/data.json`; back it up. No Docker: run `DATA_DIR=/var/samket SYNC_KEY=... node server.js` behind any HTTPS proxy (nginx, Caddy), or on Render/Railway/Fly with a persistent disk.

Warranty is in days everywhere and defaults to 0. Customers open tickets with name, phone, device type and issue; a password is optional and turns their phone into an account (My tickets).
