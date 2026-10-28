// Self-hosted server: node server.js   (needs DATABASE_URL, see .env.example)
// Serves the built app from ./dist and every /api/* route from lib/handler.js.
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from './lib/env.js'

loadEnv()
const { handle } = await import('./lib/handler.js')
const { ready } = await import('./lib/db.js')
const { tg, onUpdate } = await import('./lib/tg.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const P = process.env.PORT || 3000
const W = path.join(__dirname, 'dist')
const T = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}

if (!process.env.DATABASE_URL) console.warn('WARNING: DATABASE_URL is not set, API calls will fail with 503.')
else ready().then(() => console.log('Database ready')).catch(e => console.error('Database error:', e.message))
if (!process.env.SYNC_KEY) console.warn('WARNING: SYNC_KEY is not set, using the public default "samket". Set it in .env.')

// Telegram: long polling for self-hosting (on Vercel use the /api/tg webhook instead).
if (process.env.TG_BOT_TOKEN && !process.env.TG_WEBHOOK_SECRET) {
  let off = 0
  setInterval(async () => {
    const j = await tg('getUpdates', { offset: off, timeout: 0 })
    for (const u of (j && j.result) || []) { off = u.update_id + 1; await onUpdate(u).catch(() => {}) }
  }, 8000)
}

http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x')
  if (u.pathname.startsWith('/api/')) return handle(q, r)
  const p = path.normalize(u.pathname === '/' ? '/index.html' : u.pathname)
  let f = path.join(W, p)
  if (!f.startsWith(W)) f = path.join(W, 'index.html')
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (path.extname(p)) { r.writeHead(404); return r.end('Not found') }
    f = path.join(W, 'index.html')
  }
  const ext = path.extname(f)
  r.writeHead(200, {
    'content-type': T[ext] || 'application/octet-stream',
    // the service worker and the HTML shell must always be revalidated so updates reach users
    'cache-control': /sw\.js$|\.html$/.test(f) ? 'no-cache' : ext === '.js' || ext === '.css' ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
  })
  fs.createReadStream(f).pipe(r)
}).listen(P, () => console.log('Samket running on http://localhost:' + P))
