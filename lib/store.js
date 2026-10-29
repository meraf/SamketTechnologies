import crypto from 'crypto'
import { q, tx } from './db.js'
import { normPhone } from './phone.js'

export { normPhone }

const LOCK = 'select pg_advisory_xact_lock(11)' // serialises writers so `seq` order == commit order
const rowDoc = r => ({ ...r.data, seq: Number(r.seq) })
const strip = ({ id, type, seq, ...rest } = {}) => rest

const UPSERT = `
insert into docs (id, seq, type, ts, dev, phone, del, data)
values ($1, nextval('docs_seq'), $2, $3, $4, $5, $6, $7::jsonb)
on conflict (id) do update set
  seq = excluded.seq, type = excluded.type, ts = excluded.ts, dev = excluded.dev,
  phone = excluded.phone, del = excluded.del, data = excluded.data
where docs.ts < excluded.ts or (docs.ts = excluded.ts and docs.dev < excluded.dev)`

// ---- documents (same last-writer-wins rule the old file store used) ----
export async function upsertDocs(docs) {
  const list = (docs || []).filter(d => d && d.id && d.type)
  if (!list.length) return
  await q('select 1')
  await tx(async c => {
    await c.query(LOCK)
    for (const d of list) {
      const { seq, ...data } = d
      await c.query(UPSERT, [String(d.id), String(d.type), +d.ts || 0, String(d.dev || ''), normPhone(d.phone) || null, !!d.del, data])
    }
  })
}

export const maxSeq = async () => Number((await q('select coalesce(max(seq),0) as m from docs')).rows[0].m)

/** One page of changes, capped by rows and bytes so a response stays under Vercel's 4.5 MB limit. */
export async function docsSince(since, maxRows = 1000, maxBytes = 3.2e6) {
  const top = await maxSeq() // read BEFORE the page: a doc written in between is simply re-sent next time
  const { rows } = await q('select data, seq, octet_length(data::text) as sz from docs where seq > $1 order by seq limit $2', [since, maxRows + 1])
  const out = []
  let bytes = 0
  let more = rows.length > maxRows
  for (const r of rows.slice(0, maxRows)) {
    if (out.length && bytes + Number(r.sz) > maxBytes) { more = true; break }
    bytes += Number(r.sz)
    out.push(rowDoc(r))
  }
  return { seq: more ? out[out.length - 1].seq : top, docs: out, more }
}

export async function getDoc(id) {
  const { rows } = await q('select data, seq from docs where id = $1', [id])
  return rows[0] ? rowDoc(rows[0]) : null
}

/** PATCH (merge) or PUT (replace) one record. 409 = someone else changed it after `base`. */
export async function patchDoc(id, { patch, doc, base, ts, dev, replace }) {
  await q('select 1')
  return tx(async c => {
    await c.query(LOCK)
    const { rows } = await c.query('select data, seq, ts from docs where id = $1 for update', [id])
    if (!rows.length) return { status: 404 }
    const cur = rowDoc(rows[0])
    if (base != null && Number(rows[0].ts) > Number(base)) return { status: 409, doc: cur }
    const { seq: _s, ...curData } = cur
    const next = {
      ...(replace ? {} : curData), ...strip(replace ? doc : patch),
      id, type: cur.type, dev: dev || 'web',
      ts: Math.max(+ts || Date.now(), Number(rows[0].ts) + 1),
    }
    const s = Number((await c.query("select nextval('docs_seq') as s")).rows[0].s)
    await c.query('update docs set seq=$2, ts=$3, dev=$4, phone=$5, del=$6, data=$7::jsonb where id=$1',
      [id, s, next.ts, next.dev, normPhone(next.phone) || null, !!next.del, next])
    return { status: 200, doc: { ...next, seq: s } }
  })
}

// ---- staff search: customer name, phone number or ticket code (also device / IMEI) ----
const esc = s => String(s).replace(/[\\%_]/g, '\\$&')
export async function searchDocs(text) {
  const t = String(text || '').trim().slice(0, 60)
  if (t.length < 2) return []
  const dig = t.replace(/\D/g, '').replace(/^(0|251)/, '')
  const { rows } = await q(
    `select data, seq from docs where not del and type in ('ticket','cust') and (
       data->>'name' ilike $1 or data->>'code' ilike $1 or data->>'device' ilike $1 or data->>'imei' ilike $1
       or ($2::text is not null and phone like $2)) order by ts desc limit 60`,
    ['%' + esc(t) + '%', dig.length >= 3 ? '%' + dig + '%' : null])
  return rows.map(rowDoc)
}

// ---- queries used by the public endpoints ----
export const docsOfType = async (type, extra = '', params = []) =>
  (await q(`select data, seq from docs where type = $1 and not del ${extra}`, [type, ...params])).rows.map(rowDoc)
export const ticketByCode = async code => (await docsOfType('ticket', "and upper(data->>'code') = $2", [String(code).toUpperCase()]))[0]
export const byPhone = (type, phone) => docsOfType(type, 'and phone = $2', [phone])
export const unitBySerial = async s => (await docsOfType('unit', "and data->>'serial' = $2", [String(s)]))[0]
export const saleById = async id => (await docsOfType('sale', 'and id = $2', [id]))[0]
export const hasHistory = async phone => (await q('select 1 from docs where phone = $1 and not del limit 1', [phone])).rowCount > 0

export async function stockList() {
  const items = (await docsOfType('item')).filter(i => i.pub)
  if (!items.length) return []
  const moves = await docsOfType('move')
  const units = (await docsOfType('unit')).filter(u => u.status === 'in_stock')
  return items.map(i => ({
    id: i.id, name: i.name, cat: i.cat, price: i.price, war: i.war, img: i.img,
    stock: moves.filter(m => m.item === i.id).reduce((a, m) => a + m.q, 0) + units.filter(u => u.itemId === i.id).length,
  }))
}

/** Atomic "R-12" style numbers that also continue from the highest code already stored. */
export async function nextNo(prefix) {
  await q('select 1')
  return tx(async c => {
    await c.query('select pg_advisory_xact_lock(12)')
    const m = (await c.query(
      `select coalesce(max(substring(data->>'code' from '^' || $1::text || '-([0-9]+)$')::int), 0) as n
         from docs where data->>'code' ~ ('^' || $1::text || '-[0-9]+$')`, [prefix])).rows[0].n
    const r = await c.query(
      `insert into counters (prefix, n) values ($1::text, $2::int + 1)
       on conflict (prefix) do update set n = greatest(counters.n, $2::int) + 1 returning n`, [prefix, m])
    return r.rows[0].n
  })
}

// ---- customer accounts (phone number = account) ----
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex')
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
export const getUser = async phone => (await q('select * from users where phone = $1', [phone])).rows[0]
export const verifyPw = (u, pw) => !!(u && u.hash && pw && same(hash(pw, u.salt), u.hash))
export async function setPassword(phone, name, pw) {
  const salt = crypto.randomBytes(8).toString('hex')
  const r = await q(
    `insert into users (phone, name, salt, hash, created) values ($1, $2, $3, $4, $5)
     on conflict (phone) do update set salt = $3, hash = $4, name = coalesce(users.name, $2)
     where users.hash is null`, [phone, name || null, salt, hash(pw, salt), Date.now()])
  return r.rowCount > 0
}
export const ensureUser = (phone, name) =>
  q('insert into users (phone, name, created) values ($1, $2, $3) on conflict (phone) do nothing', [phone, name || null, Date.now()])

/** Make sure the staff CRM has a customer card for this phone (never overwrites an existing one). */
export async function ensureCust(phone, name) {
  const id = 'c' + phone, now = Date.now()
  await q('select 1')
  await tx(async c => {
    await c.query(LOCK)
    await c.query(
      `insert into docs (id, seq, type, ts, dev, phone, del, data) values ($1, nextval('docs_seq'), 'cust', $2, 'web', $3, false, $4::jsonb)
       on conflict (id) do nothing`, [id, now, phone, { id, type: 'cust', name, phone, ts: now, dev: 'web' }])
  })
  return id
}

// sessions: stateless signed token, 30 days
const secret = () => process.env.SESSION_SECRET || process.env.SYNC_KEY || 'samket'
const sig = s => crypto.createHmac('sha256', secret()).update(s).digest('hex')
export const makeToken = phone => {
  const p = `${phone}.${Date.now() + 30 * 864e5}`
  return Buffer.from(p).toString('base64url') + '.' + sig(p)
}
export function readToken(t) {
  try {
    const [b, s] = String(t || '').split('.')
    const p = Buffer.from(b, 'base64url').toString()
    const [phone, exp] = p.split('.')
    return same(sig(p), s) && +exp > Date.now() ? phone : null
  } catch { return null }
}

// ---- telegram link table ----
export const setTg = (code, chat) =>
  q('insert into tg (code, chat) values ($1, $2) on conflict (code) do update set chat = $2', [code, chat])
export const getTg = async code => (await q('select chat from tg where code = $1', [code])).rows[0]?.chat
