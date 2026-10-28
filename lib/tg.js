import { setTg } from './store.js'

export const tg = (method, body) => process.env.TG_BOT_TOKEN
  ? fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => 0)
  : Promise.resolve(0)

/** Handles one Telegram update ("/start R-12" links a chat to a ticket). Used by polling and by the webhook. */
export async function onUpdate(u) {
  const m = u && u.message
  const c = ((m && m.text || '').match(/^\/start\s+(\S+)/) || [])[1]
  if (!c) return
  await setTg(c.toUpperCase(), m.chat.id)
  await tg('sendMessage', { chat_id: m.chat.id, text: 'Samket: you will get updates for ticket ' + c.toUpperCase() + ' here.' })
}
