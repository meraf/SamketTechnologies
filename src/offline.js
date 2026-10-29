// Offline plumbing shared by the app AND the service worker (so it must not touch window/localStorage).
//  - IndexedDB (via `idb`) holds three stores:
//      d      every record (tickets, sales, stock...)  -> written locally first, synced when online
//      outbox queued API calls made while offline (customer requests, Telegram notices...)
//      meta   server URL / sync key mirrored so the service worker can replay the outbox
//  - flushOutbox() replays the queue in order whenever a connection is available.
import { openDB } from 'idb'
import { DEFAULT_SYNC_KEY } from '../lib/defaults.js'

export const bus = new EventTarget()
export const ping = () => bus.dispatchEvent(new Event('c'))

let _p
export const idb = () => _p || (_p = openDB('samket', 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('d')) db.createObjectStore('d', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'qid', autoIncrement: true })
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
  },
}))

export const setMeta = (k, v) => idb().then(d => d.put('meta', v, k))
export const getMeta = k => idb().then(d => d.get('meta', k))
export const pendingCount = () => idb().then(d => d.count('outbox')).catch(() => 0)

async function registerBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready
    await reg?.sync?.register('samket-sync') // Chrome/Android: the browser wakes the SW once online
  } catch {}
}

/** Remember an API call to make later. a = { url, method?, body?, auth?: 'key' } */
export async function enqueue(a) {
  const d = await idb()
  await d.add('outbox', { method: 'POST', ...a, created: Date.now() })
  ping()
  registerBackgroundSync()
}

/** enqueue + try right now when online (so online behaviour is unchanged). */
export async function queue(a) {
  await enqueue(a)
  if (typeof navigator !== 'undefined' && navigator.onLine) flushOutbox().catch(() => {})
}

async function run() {
  const d = await idb()
  const surl = (await getMeta('surl')) || ''
  const skey = (await getMeta('skey')) || DEFAULT_SYNC_KEY
  let sent = 0
  for (const a of await d.getAll('outbox')) {
    try {
      const r = await fetch(surl + a.url, {
        method: a.method,
        headers: { 'content-type': 'application/json', ...(a.auth === 'key' ? { 'x-key': skey } : {}) },
        body: a.body == null ? undefined : JSON.stringify(a.body),
      })
      // 2xx = done. 4xx (except timeout / rate-limit) = the server will never accept it: drop. Otherwise keep and stop.
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)) {
        await d.delete('outbox', a.qid)
        sent++
      } else break
    } catch { break } // still offline
  }
  if (sent) ping()
  return sent
}

/** Replays the queue; the Web Lock stops the page and the service worker sending the same entry twice. */
export const flushOutbox = () => (typeof navigator !== 'undefined' && navigator.locks)
  ? navigator.locks.request('samket-outbox', { ifAvailable: true }, l => (l ? run() : 0))
  : run()
