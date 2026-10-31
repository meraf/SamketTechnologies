# Samket update 2: changed / new files only
Copy over the same paths, then `npm run build` and redeploy.

NEW   src/bankpay.jsx   bank dropdown, receipt upload/photo, reference entry, RECEIPT VERIFIED / FAILED badge, receiver-name matching
NEW   lib/checkEt.js    server-side Check.et client (Bearer key, JSON for reference, multipart for receipt file)
MOD   lib/handler.js    POST /api/verify-payment (staff key required; Check.et key never reaches the browser)
MOD   src/pages/Pos.jsx payment = Cash | Bank transfer; bank panel; bank, txRef, verify{status,raw,...} saved on the sale
MOD   src/pages/Cash.jsx Cash / Transaction / All tabs with sorting, store bank accounts (docs type "bankacct")
MOD   src/pages/Inventory.jsx per-unit variant entry; Enter or "Next / Add Another" saves the unit and refocuses the serial box
MOD   src/ui.jsx        Scan (next button, refocus), A4 right-hand tear-away strip, bank lines on sale slips
MOD   src/pages/NewTicket.jsx stub = Customer, Phone, Date, Problem
MOD   src/pages/B2b.jsx keeps bottom stub for B2B documents (stubPos: "bottom")
MOD   src/catalogue.jsx shop falls back to per-unit variants for condition / RAM / storage
MOD   .env.example      CHECK_ET_API_KEY

REQUIRED: set CHECK_ET_API_KEY in Vercel / .env (server-side only, no VITE_ prefix).
