import crypto from 'crypto'
import { setTg, ticketByCode, kvGet, kvSet, kvAll, docsOfType } from './store.js'

export const tg = (method, body) => process.env.TG_BOT_TOKEN
  ? fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => 0)
  : Promise.resolve(0)

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex')
const same = (a, b) => { a = Buffer.from(a); b = Buffer.from(b); return a.length === b.length && crypto.timingSafeEqual(a, b) }
const CODE = /^SKT-[A-Z0-9]{6,8}$/, SESSION_MS = 8 * 36e5
const first = n => String(n || '').trim().split(/\s+/)[0]
const say = (chat, text) => tg('sendMessage', { chat_id: chat, text })
const isAdmin = async chat => { const s = await kvGet('tgadmin:' + chat); return !!(s && s.until > Date.now()) }

/** Chats with a live admin session (they receive the master alerts). */
export const adminChats = async () => (await kvAll('tgadmin:')).filter(r => r.v.until > Date.now()).map(r => r.k.slice(8))
export const alertAdmins = async text => { for (const c of await adminChats()) await say(c, text) }

async function summary() {
  const t0 = new Date().setHours(0, 0, 0, 0)
  const sales = (await docsOfType('sale')).filter(s => !s.void && s.date >= t0)
  const tickets = await docsOfType('ticket')
  const done = tickets.filter(t => t.status === 'Delivered' && t.done >= t0)
  const open = tickets.filter(t => !['Delivered', 'Unrepairable'].includes(t.status)).length
  const a = sales.reduce((x, s) => x + s.total, 0), b = done.reduce((x, t) => x + (+t.cost || 0), 0)
  return `Today\nSales: ${sales.length} (${a} ETB)\nRepairs delivered: ${done.length} (${b} ETB)\nTotal: ${a + b} ETB\nOpen repairs: ${open}`
}

/** One Telegram update. Customers can only bind and read their own ticket; /admin needs the passcode. */
export async function onUpdate(u) {
  const m = u && u.message
  if (!m || !m.text || !m.chat || m.chat.type !== 'private') return
  const chat = m.chat.id, t = m.text.trim(), parts = t.split(/\s+/), cmd = parts[0].toLowerCase().replace(/@\w+$/, ''), arg = parts[1]
  const st = await kvGet('tgstate:' + chat)
  if (st && st.wait && !t.startsWith('/')) {
    await kvSet('tgstate:' + chat, {})
    tg('deleteMessage', { chat_id: chat, message_id: m.message_id })
    const f = (await kvGet('tgfail:' + chat)) || { n: 0, until: 0 }
    if (f.until > Date.now()) return say(chat, 'Too many wrong attempts. Try again in 15 minutes.')
    const want = String(process.env.ADMIN_TELEGRAM_SECRET_HASH || '').toLowerCase()
    if (want && same(sha(t), want)) {
      await kvSet('tgfail:' + chat, { n: 0, until: 0 })
      await kvSet('tgadmin:' + chat, { until: Date.now() + SESSION_MS, token: crypto.randomBytes(24).toString('hex') })
      return say(chat, 'Admin access granted for 8 hours.\n/today for today\'s summary, /logout to sign out.\nSale and repair-ready alerts will arrive here.')
    }
    const n = f.n + 1
    await kvSet('tgfail:' + chat, { n, until: n >= 5 ? Date.now() + 15 * 6e4 : 0 })
    return say(chat, 'Wrong passcode.')
  }
  if (cmd === '/admin') {
    if (!process.env.ADMIN_TELEGRAM_SECRET_HASH) return say(chat, 'Admin access is not set up on this server.')
    await kvSet('tgstate:' + chat, { wait: 1 })
    return say(chat, 'Enter the admin passcode now. Your message will be deleted.')
  }
  if (cmd === '/logout') { await kvSet('tgadmin:' + chat, { until: 0 }); return say(chat, 'Signed out.') }
  if (cmd === '/today') return (await isAdmin(chat)) ? say(chat, await summary()) : say(chat, 'That command is only for shop admins.')
  if (cmd === '/start' || cmd === '/track') {
    const c = String(arg || '').toUpperCase()
    if (!c) return say(chat, 'Hello! To follow your repair, send /track followed by your ticket number, for example /track SKT-9K2P8X.')
    const tk = CODE.test(c) && await ticketByCode(c)
    if (!tk) return say(chat, 'I could not find that ticket number. Please check it and try again.')
    await setTg(c, chat)
    return say(chat, `Hi ${first(tk.name) || 'there'}, you will now get updates for ticket ${c} here.\nStatus: ${tk.status}.`)
  }
  return say(chat, 'I can only share updates for your own repair ticket. Send /track with your ticket number, for example /track SKT-9K2P8X.')
}
