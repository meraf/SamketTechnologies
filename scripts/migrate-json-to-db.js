// npm run db:migrate [path/to/data.json]
// One-off import of the old file database (data.json) into the cloud database. Safe to re-run.
import fs from 'fs'
import { loadEnv } from '../lib/env.js'
loadEnv()
const { ready, getPool, q } = await import('../lib/db.js')
const S = await import('../lib/store.js')

const file = process.argv[2] || 'data.json'
const old = JSON.parse(fs.readFileSync(file, 'utf8'))
await ready()

const docs = Object.values(old.docs || {}).sort((a, b) => (a.seq || 0) - (b.seq || 0))
for (let i = 0; i < docs.length; i += 200) await S.upsertDocs(docs.slice(i, i + 200))
console.log(`Documents imported: ${docs.length}`)

let users = 0
for (const [phone, u] of Object.entries(old.users || {})) {
  const p = S.normPhone(phone)
  if (!p || !u.hash) continue
  const r = await q('insert into users (phone, salt, hash, created) values ($1,$2,$3,$4) on conflict (phone) do nothing', [p, u.salt, u.hash, Date.now()])
  users += r.rowCount
}
console.log(`Customer passwords imported: ${users}`)

let links = 0
for (const [code, chat] of Object.entries(old.tg || {})) { await S.setTg(code, chat); links++ }
console.log(`Telegram links imported: ${links}`)
await getPool().end()
