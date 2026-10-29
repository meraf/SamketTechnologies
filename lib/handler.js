// All API routes in one Node (req, res) handler.
//  - self-hosted: server.js calls it for every /api/* request
//  - Vercel:      api/[...path].js re-exports it as a serverless function
import crypto from 'crypto'
import { ready, q } from './db.js'
import * as S from './store.js'
import { tg, onUpdate } from './tg.js'
import { normPhone, phoneOk } from './phone.js'

const today = () => new Date().toISOString().slice(0, 10)
const cut = (v, n) => String(v ?? '').slice(0, n)

const J = (r, code, o) => {
  r.writeHead(code, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type,x-key,authorization',
  })
  r.end(JSON.stringify(o))
}

// Works with the raw Node stream (self-hosted) and with Vercel's pre-parsed req.body.
const readBody = req => new Promise(ok => {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) { try { return ok(JSON.parse(req.body.toString() || '{}')) } catch { return ok({}) } }
    if (typeof req.body === 'string') { try { return ok(JSON.parse(req.body || '{}')) } catch { return ok({}) } }
    return ok(req.body)
  }
  let b = ''
  req.on('data', c => { b += c; if (b.length > 2e7) req.destroy() })
    .on('end', () => { try { ok(JSON.parse(b || '{}')) } catch { ok({}) } })
    .on('error', () => ok({}))
})

// Per-instance rate limit (fine for a shop; use an edge/WAF limit for anything bigger).
const RL = {}
const limited = (req, bucket, max) => {
  const k = bucket + (req.headers['x-forwarded-for'] || req.socket.remoteAddress)
  const n = Date.now()
  RL[k] = (RL[k] || []).filter(t => n - t < 6e4)
  RL[k].push(n)
  return RL[k].length > max
}

const keyOk = async req => (await S.checkKey(String(req.headers['x-key'] || ''))).ok

export async function handle(req, res) {
  const u = new URL(req.url, 'http://x')
  const path = u.pathname.replace(/\/+$/, '')
  const m = req.method
  try {
    if (m === 'OPTIONS') return J(res, 200, {})
    if (path === '/api/health') { await q('select 1'); return J(res, 200, { ok: true }) }
    // Vercel cron (vercel.json) calls this every 5 days so the free Supabase project is never paused for inactivity.
    if (path === '/api/keepalive') {
      const want = process.env.CRON_SECRET
      if (want ? req.headers.authorization !== `Bearer ${want}` : limited(req, 'ka', 10)) return J(res, want ? 401 : 429, {})
      const r = await q('select now() as t')
      return J(res, 200, { ok: true, at: r.rows[0].t })
    }
    if (path === '/api/cfg') return J(res, 200, { bot: process.env.TG_BOT_USERNAME || '' })
    await ready()

    // ---- staff sync (protected by x-key) ----
    if (path === '/api/sync' && m === 'POST') {
      const ka = await S.checkKey(String(req.headers['x-key'] || ''))
      if (!ka.ok) return J(res, 401, {})
      const { since = 0, docs = [] } = await readBody(req)
      await S.upsertDocs(docs)
      const out = await S.docsSince(+since || 0)
      // a device that still uses a retired key learns the new one here and switches by itself
      return J(res, 200, ka.cur ? out : { ...out, newKey: ka.key })
    }

    if (path === '/api/search' && m === 'GET') {
      if (!(await keyOk(req))) return J(res, 401, {})
      return J(res, 200, { docs: await S.searchDocs(u.searchParams.get('q')) })
    }

    // ---- admin changes the shared sync key; other devices pick it up during their next sync ----
    if (path === '/api/synckey' && m === 'POST') {
      if (limited(req, 'sk', 10)) return J(res, 429, {})
      if (!(await S.checkKey(String(req.headers['x-key'] || ''))).ok) return J(res, 401, {})
      const k = String((await readBody(req)).newKey || '').trim()
      if (k.length < 16 || k.length > 200 || /\s/.test(k)) return J(res, 400, { error: 'bad_key' })
      await S.setKey(k)
      return J(res, 200, { ok: true })
    }

    // ---- update one record: PATCH merges, PUT replaces (x-key) ----
    const dm = path.match(/^\/api\/docs\/([^/]+)$/)
    if (dm && (m === 'PATCH' || m === 'PUT')) {
      if (!(await keyOk(req))) return J(res, 401, {})
      const id = decodeURIComponent(dm[1]), b = await readBody(req)
      const out = await S.patchDoc(id, { patch: b.patch, doc: b.doc, base: b.base, ts: b.ts, dev: b.dev, replace: m === 'PUT' })
      return J(res, out.status, out.status === 404 ? { error: 'not_found' } : out.status === 409 ? { error: 'conflict', doc: out.doc } : { doc: out.doc })
    }
    if (dm && m === 'GET') {
      if (!(await keyOk(req))) return J(res, 401, {})
      const d = await S.getDoc(decodeURIComponent(dm[1]))
      return d ? J(res, 200, { doc: d }) : J(res, 404, { error: 'not_found' })
    }

    if (path === '/api/notify' && m === 'POST') {
      if (!(await keyOk(req))) return J(res, 401, {})
      const x = await readBody(req)
      const chat = await S.getTg(cut(x.code, 40).toUpperCase())
      if (chat) await tg('sendMessage', { chat_id: chat, text: cut(x.text, 500) })
      return J(res, 200, { sent: !!chat })
    }

    // Staff alert: sale / ticket / staff update -> the TG_STAFF_CHAT group (x-key protected)
    if (path === '/api/staff-alert' && m === 'POST') {
      if (!(await keyOk(req))) return J(res, 401, {})
      const x = await readBody(req), chat = process.env.TG_STAFF_CHAT
      if (chat) await tg('sendMessage', { chat_id: chat, text: cut(x.text, 500) })
      return J(res, 200, { sent: !!chat })
    }

    // Telegram webhook (use this on Vercel instead of polling). Set TG_WEBHOOK_SECRET.
    if (path === '/api/tg' && m === 'POST') {
      const want = process.env.TG_WEBHOOK_SECRET
      if (!want || req.headers['x-telegram-bot-api-secret-token'] !== want) return J(res, 404, {})
      await onUpdate(await readBody(req))
      return J(res, 200, { ok: true })
    }

    // ---- public: catalogue + ticket tracking ----
    if (path === '/api/pub') return J(res, 200, await S.stockList())
    if (path === '/api/track') {
      const t = await S.ticketByCode(u.searchParams.get('c') || '')
      return t ? J(res, 200, { code: t.code, device: t.device, status: t.status, work: t.work, why: t.why, war: t.war, done: t.done, hist: (t.hist || []).map(h => ({ s: h.s, t: h.t })) }) : J(res, 404, {})
    }

    // ---- public: purchase lookup + warranty claim ----
    if (path === '/api/purchase' && m === 'POST') {
      if (limited(req, 'p', 20)) return J(res, 429, {})
      const x = await readBody(req)
      const c = cut(x.code, 80).trim(), p = normPhone(x.phone)
      if (!c || !p) return J(res, 404, {})
      const sales = await S.byPhone('sale', p)
      let s = sales.find(y => y.code === c.toUpperCase() || (y.lines || []).some(l => l.serial === c || l.imei === c || (l.imeis || []).includes(c)))
      if (!s) { const n = await S.unitBySerial(c); s = n && sales.find(y => y.id === n.saleId) }
      if (!s) return J(res, 404, {})
      return J(res, 200, { code: s.code, date: s.date, name: s.name, phone: s.phone, lines: s.lines, total: s.total, disc: s.disc, pay: s.pay, void: s.void })
    }
    if (path === '/api/claimreq' && m === 'POST') {
      if (limited(req, 'c', 20)) return J(res, 429, {})
      const x = await readBody(req)
      const n = await S.unitBySerial(cut(x.serial, 80).trim())
      const s = n && await S.saleById(n.saleId)
      if (!s || normPhone(s.phone) !== normPhone(x.phone) || !n.until || n.until < today()) return J(res, 400, {})
      const id = 'w' + Date.now().toString(36), code = 'WC-WEB-' + Math.random().toString(36).slice(2, 6).toUpperCase(), now = Date.now()
      await S.upsertDocs([{ id, type: 'claim', code, serial: n.serial, itemId: n.itemId, saleId: n.saleId, issue: cut(x.issue, 300), status: 'Open', date: now, ts: now, dev: 'web' }])
      return J(res, 200, { code })
    }

    // ---- customer accounts: phone lookup ----
    // A = phone known + has password, B = phone known + no password, C = new phone
    if (path === '/api/auth/check-phone' && m === 'POST') {
      if (limited(req, 'cp', 60)) return J(res, 429, {})
      const { phone } = await readBody(req)
      if (!phoneOk(phone)) return J(res, 200, { valid: false, exists: false, hasPassword: false })
      const p = normPhone(phone), usr = await S.getUser(p)
      const exists = !!usr || await S.hasHistory(p)
      return J(res, 200, { valid: true, exists, hasPassword: !!(usr && usr.hash) })
    }

    // Log in (A), claim an existing history by setting a password (B), or create a profile (C).
    if (path === '/api/auth/access' && m === 'POST') {
      if (limited(req, 'ac', 20)) return J(res, 429, {})
      const x = await readBody(req)
      if (!phoneOk(x.phone)) return J(res, 400, { error: 'bad_phone' })
      const p = normPhone(x.phone), pw = String(x.password || ''), usr = await S.getUser(p)
      if (usr && usr.hash) {
        if (!S.verifyPw(usr, pw)) return J(res, 401, { error: 'wrong_password' })
        return J(res, 200, { ok: true, token: S.makeToken(p), scenario: 'A' })
      }
      const known = !!usr || await S.hasHistory(p)
      if (pw) {
        if (pw.length < 4) return J(res, 400, { error: 'password_short' })
        await S.setPassword(p, cut(x.name, 80), pw)
        await S.ensureCust(p, cut(x.name, 80))
        return J(res, 200, { ok: true, token: S.makeToken(p), scenario: known ? 'B' : 'C', claimed: known })
      }
      if (known) return J(res, 200, { ok: false, needsPassword: true, scenario: 'B' })
      await S.ensureUser(p, cut(x.name, 80))
      await S.ensureCust(p, cut(x.name, 80))
      return J(res, 200, { ok: true, token: S.makeToken(p), scenario: 'C' })
    }

    // ---- public repair request (also creates / links the customer account) ----
    if (path === '/api/req' && m === 'POST') {
      if (limited(req, 'r', 20)) return J(res, 429, {})
      const x = await readBody(req)
      const name = cut(x.name, 80), dtype = cut(x.dtype, 20), issue = cut(x.issue, 400), pw = String(x.password || '')
      if (!name || !phoneOk(x.phone) || !dtype || !issue) return J(res, 400, { error: 'missing_fields' })
      const phone = normPhone(x.phone), usr = await S.getUser(phone)
      if (usr && usr.hash) { // Scenario A: must authenticate; the ticket joins the existing history
        if (!S.verifyPw(usr, pw)) return J(res, 401, { error: 'wrong_password' })
      } else if (pw) {        // Scenario B/C: optional password claims / secures the phone number
        if (pw.length < 4) return J(res, 400, { error: 'password_short' })
        await S.setPassword(phone, name, pw)
      } else if (!usr) await S.ensureUser(phone, name)
      const custId = await S.ensureCust(phone, name)
      const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), code = 'R-' + await S.nextNo('R'), now = Date.now()
      await S.upsertDocs([{
        id, type: 'ticket', code, custId, name, phone, email: cut(x.email, 80), dtype,
        device: (dtype + ' ' + cut(x.device, 80)).trim(), imei: cut(x.imei, 40), issue,
        status: 'Requested', war: 0, cost: 0, date: now, done: null, hist: [{ s: 'Requested', t: now }], ts: now, dev: 'web',
      }])
      if (process.env.TG_STAFF_CHAT) tg('sendMessage', { chat_id: process.env.TG_STAFF_CHAT, text: `New repair request ${code}: ${name} ${phone} - ${cut(issue, 200)}` })
      return J(res, 200, { code, custId })
    }

    // ---- "my history": signed-in customer (Bearer token; phone+password still accepted) ----
    if (path === '/api/my' && m === 'POST') {
      if (limited(req, 'my', 30)) return J(res, 429, {})
      const x = await readBody(req)
      let p = S.readToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
      if (!p && x.phone) {
        const usr = await S.getUser(normPhone(x.phone))
        if (S.verifyPw(usr, String(x.password || ''))) p = normPhone(x.phone)
      }
      if (!p) return J(res, 401, {})
      const [tickets, sales] = await Promise.all([S.byPhone('ticket', p), S.byPhone('sale', p)])
      return J(res, 200, {
        phone: p,
        tickets: tickets.sort((a, b) => b.date - a.date).map(t => ({ code: t.code, device: t.device, status: t.status, work: t.work, why: t.why, done: t.done, war: t.war, hist: t.hist })),
        purchases: sales.filter(s => !s.void).sort((a, b) => b.date - a.date).map(s => ({ code: s.code, date: s.date, total: s.total, items: (s.lines || []).map(l => `${l.q} × ${l.name}`) })),
      })
    }

    return J(res, 404, { error: 'not_found' })
  } catch (e) {
    console.error('api error', path, e)
    if (e.code === 'NO_DATABASE_URL') return J(res, 503, { error: 'database_not_configured' })
    return J(res, 500, { error: 'server_error' })
  }
}
