# Samket: Supabase database + Telegram bot (setup and security guide)

How your app is wired (so the guide matches the code):

```
Browser (React)  ──fetch /api/*──►  Vercel function api/[...path].js  ──pg (DATABASE_URL)──►  Supabase Postgres
                                              └──fetch──► api.telegram.org (bot token stays on the server)
```
The browser never talks to Supabase or Telegram directly. That is the secure design: the only secrets
(`DATABASE_URL`, `TG_BOT_TOKEN`) exist on the server. Keep it that way.

---------------------------------------------------------------------------------------------------
## PART 1: Supabase

### 1.1 Create the project
1. supabase.com → New project. Pick the region closest to your users and save the **database password**.
2. Wait until the project is ready, then open **Connect** (top bar) and copy the connection strings.
   You need two:
   - **Transaction pooler** (port **6543**) → use for **Vercel** (`DATABASE_URL`). Serverless functions open many short connections; the pooler keeps Postgres healthy.
   - **Direct / session** (port **5432**) → use on your own laptop for one-off scripts (`db:init`, `db:migrate`) if the pooler gives trouble.
3. If your password contains `@ : / ? # %` replace each with its URL-encoded form (`@`→`%40`, `#`→`%23`, `/`→`%2F`).

### 1.2 Environment variables (this app)

| Variable | Where | Secret? | Value |
|---|---|---|---|
| `DATABASE_URL` | local `.env` + Vercel | **YES** | `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` |
| `SYNC_KEY` | local + Vercel | YES | long random string; staff devices send it as `x-key` |
| `SESSION_SECRET` | local + Vercel | YES | another long random string (signs customer login tokens) |
| `TG_BOT_TOKEN`, `TG_STAFF_CHAT`, `TG_WEBHOOK_SECRET`, `TG_BOT_USERNAME` | local + Vercel | token & secret: YES | see Part 2 |

Generate random strings: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Rules:
- **Never** give a secret the `VITE_` prefix: Vite copies every `VITE_*` variable into the public JavaScript.
- **Never** put the Supabase `service_role` key or the database URL in React code. This app does not need either in the browser.
- Vercel: Project → Settings → Environment Variables → add for Production **and** Preview → **redeploy** (variables are read at build/boot, old deployments do not see new ones).
- Local: `.env` is already in `.gitignore`. Never commit it.

### 1.3 How the backend connects (already in `lib/db.js`)
```js
import pg from 'pg'
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,   // from env, never hard-coded
  ssl: { rejectUnauthorized: false },           // Supabase requires TLS
  max: process.env.VERCEL ? 1 : 5,              // one connection per serverless instance
})
// ALWAYS parameterised: user input goes in the array, never into the SQL string
await pool.query('select * from docs where type = $1 and phone = $2', ['ticket', phone])
```
Check it works: open `https://samket.vercel.app/api/health` → `{"ok":true}`.
`503 database_not_configured` = `DATABASE_URL` missing on Vercel. `500` = wrong password or host (see the Vercel function log).

### 1.4 Lock the tables (IMPORTANT, do this once)
Supabase publishes every table in the `public` schema through its REST API using the public **anon** key.
Without Row Level Security, anyone could read your customers and sales with that key. Your server connects as the
`postgres` owner role, which bypasses RLS, so turning RLS on does **not** affect the app. Run in **SQL Editor**
(after the app has created the tables: `npm run db:init`):

```sql
alter table public.docs     enable row level security;
alter table public.users    enable row level security;
alter table public.tg       enable row level security;
alter table public.counters enable row level security;
-- no policies = the anon / authenticated roles can read and write nothing
revoke all on public.docs, public.users, public.tg, public.counters from anon, authenticated;
revoke all on sequence public.docs_seq from anon, authenticated;
```
Test: `curl "https://<ref>.supabase.co/rest/v1/docs?select=*" -H "apikey: <ANON_KEY>"` must return `[]` or a permission error, never data.

### 1.5 Table structure and roles
The app stores every record in one table `docs(id, seq, type, ts, dev, phone, del, data jsonb)`, where `type` is
`ticket`, `sale`, `unit`, `item`, `cust`, `claim`, ... This is deliberate: it is what makes offline-first sync and
conflict handling work. **Do not split it into many tables without also rewriting the sync code.**
For reports and dashboards, add read-only **views** in a private schema instead:

```sql
create schema if not exists reporting;   -- not exposed by Supabase's REST API

create or replace view reporting.repairs as
select id, data->>'code' as code, data->>'name' as customer, phone,
       data->>'device' as device, data->>'status' as status,
       (data->>'cost')::numeric as price, (data->>'pcost')::numeric as parts_cost,
       to_timestamp((data->>'date')::bigint/1000.0) as opened,
       to_timestamp(nullif(data->>'done','null')::bigint/1000.0) as closed
from public.docs where type = 'ticket' and not del;

create or replace view reporting.transactions as
select id, data->>'code' as receipt, data->>'name' as customer, phone,
       (data->>'total')::numeric as total, data->>'pay' as payment,
       to_timestamp((data->>'date')::bigint/1000.0) as sold
from public.docs where type = 'sale' and not del and coalesce(data->>'void','') <> 'true';
```
Query them in the SQL Editor, or from Metabase / Google Sheets with a **read-only** database user.

**Staff roles.** Today the PINs (cashier 1111, admin 9999) are checked in the browser, so they are only a UI gate.
For real security create a server-side staff table:
```sql
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null check (role in ('admin','cashier')),
  pin_salt text not null, pin_hash text not null,      -- scrypt, never the plain PIN
  active boolean not null default true, created_at timestamptz default now());
alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;
```
Then add a `/api/staff/login` route (checks the PIN with scrypt like `verifyPw` in `lib/store.js`, returns
`makeToken(...)` with the role) and make `/api/sync` accept that token instead of the shared `SYNC_KEY`.
Ask me and I will wire this into the app; it is not in this update.

### 1.6 Real-time data (optional)
Do **not** open `docs` to the anon key for Realtime; that would expose the data. Safe patterns:
- **Current behaviour (recommended):** each staff device syncs on login, every 20 s, when it comes back online and when the tab becomes visible. No extra setup.
- **Instant updates without exposing data:** after each write the server sends an empty "something changed" ping on a Supabase *Broadcast* channel; devices respond by running `sync()`, which still goes through the protected API.
```js
// server (lib/realtime.js)   npm i @supabase/supabase-js     env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only!)
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
export const pingClients = () => sb.channel('samket-changes').send({ type: 'broadcast', event: 'changed', payload: {} })
// call pingClients() at the end of upsertDocs() in lib/store.js

// browser (staff only)       env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (these two are public by design)
import { createClient } from '@supabase/supabase-js'
const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
sb.channel('samket-changes').on('broadcast', { event: 'changed' }, () => sync()).subscribe()
```

### 1.7 Good habits
- Parameterised queries only (`$1`, `$2`). Never build SQL by joining strings.
- Back up: Supabase keeps daily backups on paid plans; on the free plan run `pg_dump "<direct 5432 url>" > backup.sql` weekly.
- Keep the 5432 (direct) URL out of Vercel; use the 6543 pooler there.
- Rotate the database password (Project Settings → Database) if it ever appears in a chat, screenshot or commit, then update `DATABASE_URL` everywhere.

---------------------------------------------------------------------------------------------------
## PART 2: Telegram notifications

### 2.1 Create the bot
1. In Telegram open **@BotFather** → `/newbot` → choose a name and a username ending in `bot`.
2. Copy the **token** (looks like `123456789:AA...`). Treat it like a password. If it leaks: BotFather → `/revoke`.
3. Put the username (without `@`) in `TG_BOT_USERNAME`; the token in `TG_BOT_TOKEN`.

### 2.2 Find the staff chat id
1. Create a private **group** for staff (or a channel), add your bot. For a channel, make the bot an **admin** with "Post messages".
2. Send any message in the group.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find `"chat":{"id":-100123456789,...}`.
   Group and supergroup ids are negative (`-100…` for supergroups/channels). Put it in `TG_STAFF_CHAT`.
   (If it says "Conflict: webhook is active", run `…/deleteWebhook` first, read the id, then set the webhook again.)

### 2.3 Webhook (needed on Vercel; there is no always-on process for polling)
1. Set `TG_WEBHOOK_SECRET` to a random string using only letters, digits, `_` and `-`.
2. Deploy, then open this URL once in a browser (replace the three values):
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://samket.vercel.app/api/tg&secret_token=<TG_WEBHOOK_SECRET>
```
3. Verify with `…/getWebhookInfo`: `url` is yours and `last_error_message` is empty.
The route `/api/tg` rejects any request that does not carry your secret in the `X-Telegram-Bot-Api-Secret-Token` header.
Local development: leave `TG_WEBHOOK_SECRET` empty and `node server.js` polls instead (a bot cannot use polling and a webhook at once; run `deleteWebhook` when you switch to local).

### 2.4 What gets sent (already wired in this update)
| Event | Who gets it | How |
|---|---|---|
| Customer opens a ticket on the website | staff chat | `/api/req` → `tg('sendMessage', TG_STAFF_CHAT)` |
| Staff creates a ticket (Checkout) | staff chat | `alertStaff()` → `/api/staff-alert` |
| Sale completed (Checkout) | staff chat | `alertStaff()` → `/api/staff-alert` |
| Repair status change (incl. Unfixed) | the customer | `notify()` → `/api/notify`, after they press *Get updates on Telegram* on the tracking page |

Messages are queued in IndexedDB if the device is offline and sent when it reconnects.

### 2.5 Code you can reuse
**Server helper** (`lib/tg.js`), with rate-limit handling:
```js
export async function sendMessage(chat_id, text, tries = 2) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id, text: String(text).slice(0, 4000) }),   // plain text: no formatting surprises
  }).then(r => r.json()).catch(() => ({ ok: false }))
  if (!r.ok && r.error_code === 429 && tries > 0) {                          // Telegram says "slow down"
    await new Promise(ok => setTimeout(ok, (r.parameters?.retry_after || 1) * 1000))
    return sendMessage(chat_id, text, tries - 1)
  }
  return r.ok
}
```
**Trigger from a new server event** (e.g. a new API route):
```js
import { sendMessage } from './tg.js'
await sendMessage(process.env.TG_STAFF_CHAT, `Warranty claim ${code} opened for ${serial}`)
```
**Trigger from the browser** (never call Telegram directly from React; go through your protected route):
```js
import { alertStaff } from '../db'
alertStaff(`Price of ${t.code} changed to ${newCost} ETB by ${role}`)   // queued offline, sent when online
```
**Test from a terminal:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/sendMessage" -d chat_id=<TG_STAFF_CHAT> -d text="Samket test"
curl -X POST https://samket.vercel.app/api/staff-alert -H "content-type: application/json" -H "x-key: <SYNC_KEY>" -d '{"text":"test from api"}'
```

### 2.6 Security checklist
- Token only in server env vars. Never in React, never in a `VITE_` variable, never in git.
- Use a **private** staff group; messages include customer names and phones.
- Keep `TG_WEBHOOK_SECRET` set on Vercel so nobody can fake updates.
- Keep messages short and avoid full IMEIs, prices of purchases for customers, passwords or PINs.

### 2.7 Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Nothing arrives from Vercel | `TG_BOT_TOKEN` / `TG_STAFF_CHAT` missing in Vercel env, or not redeployed after adding |
| `chat not found` (400) | wrong chat id, or the bot is not in that group/channel |
| `bot was kicked` / `forbidden` (403) | re-add the bot; customers must press *Start* in the bot first |
| `Unauthorized` (401) | wrong or revoked token |
| `Conflict: terminated by other getUpdates` (409) | polling and webhook active together; `deleteWebhook` or remove `TG_WEBHOOK_SECRET` locally |
| Customer "Get updates" does nothing | webhook not set (2.3), or `TG_WEBHOOK_SECRET` differs from the one in `setWebhook` |
