# Samket Technologies
Storefront (`/`) + shop app (`/admin.html`, PIN 1234, installable on any phone/PC as an app).

**Run:** `node server.js` (Node 18+), open http://localhost:3000. Set `SYNC_KEY` and change the PIN in Settings.
**Other devices:** host this folder on an HTTPS server (VPS + Caddy, or Cloudflare Tunnel). Service workers need HTTPS except on localhost. In Settings on each device, set the server URL and key.

**Offline & conflicts:** every device keeps a full IndexedDB copy and works with no internet. Stock is the sum of append-only movements (sales/receipts), so two offline devices selling the same item merge correctly; edits to items/tickets are last-write-wins per record; ticket and receipt codes include the device ID so they never clash. Sync runs every 20 s and on reconnect.

**Edit:** shop phone, address, hours and testimonials at the top of `public/index.html`. Data lives in `data.json` (back it up).
