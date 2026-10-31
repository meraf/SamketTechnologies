# Samket update: changed files only
Copy these files over the same paths in the project, then `npm run build` and redeploy. No database migration is needed (records are JSON documents).
Optional env: VITE_GOOGLE_MAPS_KEY (Google Maps Embed API key, restricted to your domain). Without it the keyless Google Maps embed is used.
New doc types created automatically: `b2bpay` (confirmed B2B payments). New fields: item.cond/condNote/screen, unit.ram/storage/cond/condNote, b2b.terms/nextDue/paid.

Client: ui.jsx (Ticket Created! modal), catalogue.jsx (specs pop-up), Contact.jsx (Google Maps), Track.jsx, lib/store.js (public catalogue fields)
Staff: Pos.jsx, Inventory.jsx, Repairs.jsx (tear-away only at step 1), B2b.jsx, Analytics.jsx (B2B revenue = confirmed payments), App.jsx (due banner), Purchases.jsx
Print: index.css + ui.jsx (single-page A4 engine). Reminders: lib/handler.js + vercel.json (daily cron /api/b2b-due)
