// Z CLOUD service worker. It does two things only: show push alerts and open the right screen when one is tapped.
// It caches nothing, so the app always loads the newest version.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})   // browsers only offer "Install app" when a fetch handler exists; we let every request go to the network

const hashOf = (u) => (typeof u === 'string' && /^#\/[\w\/-]{0,80}$/.test(u) ? u : '#/')

// The unread number on the app icon. The page writes the real count (src/lib/badge.ts); this adds one per alert while no page is looking after it.
const DB = 'zcloud-badge', STORE = 'kv', KEY = 'badge'
const openDb = () => new Promise((res) => {
  try { const rq = indexedDB.open(DB, 1); rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE) }; rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null) } catch (e) { res(null) }
})
const readBadge = async () => {
  const db = await openDb(); if (!db) return { n: 0, at: 0 }
  const v = await new Promise((res) => { try { const r = db.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => res(r.result); r.onerror = () => res(null) } catch (e) { res(null) } })
  db.close(); return v && typeof v.n === 'number' ? v : { n: 0, at: 0 }
}
const writeBadge = async (m) => {
  const db = await openDb(); if (!db) return
  await new Promise((res) => { try { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(m, KEY); t.oncomplete = () => res(); t.onerror = () => res(); t.onabort = () => res() } catch (e) { res() } })
  db.close()
}
async function bumpBadge(visible) {
  try {
    if (visible || !('setAppBadge' in self.navigator)) return                 // somebody is looking at Z CLOUD: the page keeps the number right
    const cur = await readBadge()
    if (Date.now() - cur.at < 8000) return                                    // the page refreshed the count a moment ago, so it already includes this alert
    const n = Math.min(cur.n + 1, 99999)
    await writeBadge({ n, at: Date.now() })
    await self.navigator.setAppBadge(n)
  } catch (e) { /* the badge is a convenience */ }
}

self.addEventListener('push', (event) => {
  let m = {}
  try { m = event.data ? event.data.json() : {} } catch (e) { m = { body: event.data ? event.data.text() : '' } }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (m.tag !== 'test') await bumpBadge(wins.some((w) => w.visibilityState === 'visible'))
    if (wins.some((w) => w.focused) && m.tag !== 'test') return   // the person is looking at Z CLOUD right now: the bell already shows it
    await self.registration.showNotification(String(m.title || 'Z CLOUD').slice(0, 80), {
      body: String(m.body || '').slice(0, 240),
      icon: 'brand/icon-192.png',
      tag: m.tag ? String(m.tag).slice(0, 64) : undefined,
      renotify: !!m.tag,
      data: { hash: hashOf(m.url) },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const hash = hashOf(event.notification.data && event.notification.data.hash)
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const w = wins.find((c) => c.url.startsWith(self.registration.scope))
    if (w) { await w.focus(); w.postMessage({ type: 'navigate', hash }); return }
    await self.clients.openWindow(self.registration.scope + hash)
  })())
})
