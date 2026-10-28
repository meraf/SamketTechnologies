// Service worker (built by vite-plugin-pwa "injectManifest", so Workbox precaches every build file).
//  - app shell + JS/CSS/icons: precache (cache-first, versioned by Workbox)
//  - any page route (/, /shop, /staff/pos ...): served from the cached index.html so the SPA opens offline
//  - /api/pub, /api/cfg: stale-while-revalidate     /api/track: network-first with cache fallback
//  - images / fonts: cache-first with expiry
//  - Background Sync: when the connection returns the browser wakes this worker, which replays the
//    IndexedDB outbox and tells open tabs to sync their records.
import {clientsClaim} from 'workbox-core'
import {precacheAndRoute,cleanupOutdatedCaches,createHandlerBoundToURL} from 'workbox-precaching'
import {registerRoute,NavigationRoute} from 'workbox-routing'
import {StaleWhileRevalidate,CacheFirst,NetworkFirst} from 'workbox-strategies'
import {ExpirationPlugin} from 'workbox-expiration'
import {CacheableResponsePlugin} from 'workbox-cacheable-response'
import {flushOutbox} from './offline'

self.skipWaiting();clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.addEventListener('activate',e=>e.waitUntil(caches.delete('sk3'))) // cache of the previous hand-written worker

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'),{denylist:[/^\/api\//,/\/sw\.js$/]}))

const ok=new CacheableResponsePlugin({statuses:[200]})
registerRoute(({url})=>url.origin===self.location.origin&&/^\/api\/(pub|cfg)$/.test(url.pathname),
 new StaleWhileRevalidate({cacheName:'api-public',plugins:[ok]}))
registerRoute(({url})=>url.origin===self.location.origin&&url.pathname==='/api/track',
 new NetworkFirst({cacheName:'api-track',networkTimeoutSeconds:4,plugins:[ok,new ExpirationPlugin({maxEntries:30,maxAgeSeconds:864e3})]}))
registerRoute(({request,url})=>url.origin===self.location.origin&&['image','font'].includes(request.destination),
 new CacheFirst({cacheName:'media',plugins:[ok,new ExpirationPlugin({maxEntries:80,maxAgeSeconds:30*864e3})]}))

self.addEventListener('sync',e=>{if(e.tag!=='samket-sync')return
 e.waitUntil((async()=>{await flushOutbox();(await self.clients.matchAll({type:'window'})).forEach(c=>c.postMessage({type:'samket-sync'}))})())})
