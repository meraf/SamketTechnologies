# Samket update 3: changed files only
Copy over the same paths, then `npm run build` and redeploy.

MOD lib/checkEt.js         CBE and CBE Birr are separate codes (cbe / cbebirr); per-bank payload rules (CBE reference only, legacy FT adds last-8 account; CBE Birr = payer phone 251XXXXXXXXX; BoA = our account); refs trimmed; retry with/without account; clear failure messages
MOD src/bankpay.jsx        separate "CBE" and "CBE Birr" in the dropdown; failure note tells staff to check bank/reference or upload receipt (checkout never blocked)
MOD src/pages/Inventory.jsx rapid Enter / "Next / Add Another" entry for every serialized category; new Tablets and Other categories
MOD src/db.js              tag prefixes for Tablets (T) and Other (OT)
MOD src/ui.jsx             Tablets icon
MOD src/pages/Pos.jsx      sticky OK / Cancel footer in the variant modal; sort by Name / Type / Amount (asc/desc), 0-stock items always last
MOD src/pages/Repairs.jsx  sort by Date / Status / Time of day (asc/desc), date+time and DOA badge on each ticket
MOD src/pages/NewTicket.jsx DOA checkbox sets the whole intake checklist to N/A (editable per item); DOA saved on the ticket and printed
NOTE: after adding the "CBE" bank, save your CBE receiving account on the Cash page under bank "CBE".
