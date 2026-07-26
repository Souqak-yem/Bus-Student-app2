const CACHE = 'mashawerk-v1'
const STATIC = [
  '/manifest.json',
  '/app-icon.svg',
  '/full-logo.svg',
  '/sounds/emergency-alarm.wav',
  '/sounds/info.wav',
  '/sounds/warning.wav',
  '/fonts/cairo/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscQyyS4J0.woff2',
  '/fonts/cairo/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscSCyS4J0.woff2',
  '/fonts/cairo/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscRiyS.woff2',
]

self.addEventListener('install', (e) => {
  console.log(`[SW] Installing ${CACHE}`)
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => {
      console.log(`[SW] Static assets cached in ${CACHE}`)
    })
  )
})

self.addEventListener('activate', (e) => {
  console.log(`[SW] Activating ${CACHE}`)
  self.clients.claim()
  e.waitUntil(
    caches.keys().then((keys) => {
      const toDelete = keys.filter((k) => k !== CACHE)
      console.log(`[SW] Deleting old caches: ${toDelete.join(', ') || '(none)'}`)
      return Promise.all(toDelete.map((k) => caches.delete(k)))
    }).then(() => {
      console.log(`[SW] ${CACHE} is now active and controlling all clients`)
      return self.clients.matchAll()
    }).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED', cache: CACHE }))
    })
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  if (url.pathname.startsWith('/api/') && e.request.method === 'GET') {
    e.respondWith(networkFirst(e.request, url.pathname))
  } else if (url.pathname.startsWith('/api/')) {
    return
  } else if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(networkFirstNoCache(e.request, url.pathname))
  } else if (url.pathname.match(/\.(js|css|png|jpg|svg|wav|ico)$/)) {
    e.respondWith(cacheFirst(e.request, url.pathname))
  } else {
    e.respondWith(networkFirst(e.request, url.pathname))
  }
})

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received, activating...')
    self.skipWaiting()
  }
})

self.addEventListener('push', (e) => {
  let data
  try {
    data = e.data?.json()
  } catch {}

  if (!data) {
    data = { title: 'مشوارك', message: 'لديك إشعار جديد', priority: 'INFO' }
  }

  const options = {
    title: data.title,
    body: data.message,
    icon: '/app-icon.svg',
    badge: '/app-icon.svg',
    tag: data.notificationId || `notif-${Date.now()}`,
    data: {
      targetRoute: data.targetRoute || '/',
      notificationId: data.notificationId,
      type: data.type,
      priority: data.priority,
      createdAt: data.createdAt,
    },
    vibrate: data.priority === 'CRITICAL' ? [200, 100, 200, 100, 200] : data.priority === 'WARNING' ? [200, 100, 200] : [],
    requireInteraction: data.priority === 'CRITICAL',
  }

  e.waitUntil(self.registration.showNotification(options.title, options))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()

  const targetRoute = e.notification.data?.targetRoute || '/'
  const urlToOpen = new URL(targetRoute, self.location.origin).href

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existingClient = windowClients.find((c) => c.url === urlToOpen)
      if (existingClient) {
        return existingClient.focus()
      }
      return clients.openWindow(urlToOpen)
    })
  )
})

async function networkFirst(req, path) {
  try {
    const res = await fetch(req)
    const cache = await caches.open(CACHE)
    cache.put(req, res.clone())
    console.log(`[SW] NETWORK ✓ ${path}`)
    return res
  } catch {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    console.log(`[SW] OFFLINE → CACHE ${path}`)
    return cached || new Response(JSON.stringify({ error: 'غير متصل' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function networkFirstNoCache(req, path) {
  try {
    const noStoreReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      mode: req.mode,
      credentials: req.credentials,
      redirect: req.redirect,
      cache: 'no-store',
    })
    const res = await fetch(noStoreReq)
    console.log(`[SW] NETWORK ✓ ${path} (no-store)`)
    return res
  } catch {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    console.log(`[SW] OFFLINE → CACHE FALLBACK ${path}`)
    return cached || new Response(JSON.stringify({ error: 'غير متصل' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function cacheFirst(req, path) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(req)
  if (cached) {
    console.log(`[SW] CACHE ✓ ${path}`)
    return cached
  }
  try {
    const res = await fetch(req)
    cache.put(req, res.clone())
    console.log(`[SW] NETWORK → CACHE ${path}`)
    return res
  } catch {
    console.log(`[SW] FAILED ${path}`)
    return new Response('غير متصل', { status: 503 })
  }
}
