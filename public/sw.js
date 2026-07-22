const CACHE = 'mashawerk-v1'
const STATIC = [
  '/',
  '/index.html',
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
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC))
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    ))
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  if (url.pathname.startsWith('/api/') && e.request.method === 'GET') {
    e.respondWith(networkFirst(e.request))
  } else if (url.pathname.startsWith('/api/')) {
    return
  } else if (url.pathname.match(/\.(js|css|png|jpg|svg|wav|ico)$/)) {
    e.respondWith(cacheFirst(e.request))
  } else if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(networkFirst(e.request))
  } else {
    e.respondWith(cacheFirst(e.request))
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

async function networkFirst(req) {
  try {
    const res = await fetch(req)
    const cache = await caches.open(CACHE)
    cache.put(req, res.clone())
    return res
  } catch {
    const cached = await caches.match(req)
    return cached || new Response(JSON.stringify({ error: 'غير متصل' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    const cache = await caches.open(CACHE)
    cache.put(req, res.clone())
    return res
  } catch {
    return new Response('غير متصل', { status: 503 })
  }
}
