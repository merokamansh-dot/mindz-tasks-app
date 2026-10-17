// Z CLOUD service worker. It does two things only: show push alerts and open the right screen when one is tapped.
// It caches nothing, so the app always loads the newest version.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})   // browsers only offer "Install app" when a fetch handler exists; we let every request go to the network

const hashOf = (u) => (typeof u === 'string' && /^#\/[\w\/-]{0,80}$/.test(u) ? u : '#/')

self.addEventListener('push', (event) => {
  let m = {}
  try { m = event.data ? event.data.json() : {} } catch (e) { m = { body: event.data ? event.data.text() : '' } }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
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
