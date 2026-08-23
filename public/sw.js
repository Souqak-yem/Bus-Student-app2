const CACHE = 'mashawerk-v3'
const STATIC = [
  '/index.html',
  '/manifest.json',
  '/app-icon.svg',
  '/full-logo.svg',
  '/og-image.png',
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
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        const toDelete = keys.filter((k) => k !== CACHE)
        console.log(`[SW] Deleting old caches: ${toDelete.join(', ') || '(none)'}`)
        return Promise.all(toDelete.map((k) => caches.delete(k)))
      }),
    ]).then(() => {
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
    e.respondWith(networkFirstNoCache(e.request, url.pathname))
  } else if (url.pathname.startsWith('/api/')) {
    return
  } else if (e.request.mode === 'navigate') {
    e.respondWith(networkFirstNavigation(e.request, url.pathname))
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
    data = {
      title: 'تنسيقية مواصلات فلك',
      message: 'لديك إشعار جديد',
      priority: 'INFO',
      icon: '/app-icon.svg',
      badge: '/app-icon.svg',
      data: { url: '/' },
    }
  }

  const title = data.title || 'تنسيقية مواصلات فلك'
  const body = data.message || data.body || 'لديك إشعار جديد'
  const icon = data.icon || '/app-icon.svg'
  const badge = data.badge || '/app-icon.svg'
  const priority = data.priority || 'INFO'
  const notificationId = data.notificationId || `notif-${Date.now()}`
  const targetRoute = data.targetRoute || data.data?.url || '/'

  let vibrate = []
  if (priority === 'CRITICAL') vibrate = [200, 100, 200, 100, 200]
  else if (priority === 'WARNING') vibrate = [200, 100, 200]
  else if (priority === 'INFO') vibrate = [100, 50, 100]

  const requireInteraction = priority === 'CRITICAL'

  const options = {
    body,
    icon,
    badge,
    tag: notificationId,
    renotify: false,
    silent: false,
    vibrate,
    requireInteraction,
    timestamp: Date.now(),
    data: {
      targetRoute,
      notificationId,
      type: data.type,
      priority,
      createdAt: data.createdAt,
      ...(data.data || {}),
    },
    actions: [
      { action: 'open', title: 'عرض الآن', icon: '' },
      { action: 'close', title: 'إغلاق', icon: '' },
    ],
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (e) => {
  const { action, notification } = e
  notification.close()

  if (action === 'close') return

  const targetRoute = notification.data?.targetRoute || notification.data?.url || '/'
  const urlToOpen = new URL(targetRoute, self.location.origin).href

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length === 0) {
        return clients.openWindow(urlToOpen)
      }

      const exactClient = windowClients.find((c) => c.url === urlToOpen)
      if (exactClient) {
        return exactClient.focus()
      }

      const sameOriginClient = windowClients.find((c) => c.url.startsWith(self.location.origin))
      if (sameOriginClient) {
        if (typeof sameOriginClient.navigate === 'function') {
          return sameOriginClient.navigate(urlToOpen).then(() => sameOriginClient.focus())
        }

        const shouldPostMessage = !sameOriginClient.url.includes(targetRoute)
        if (shouldPostMessage) {
          sameOriginClient.postMessage({ type: 'SW_NAVIGATE', url: urlToOpen })
        }
        return sameOriginClient.focus()
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
    if (req.mode === 'navigate') {
      const appShell = await cache.match('/index.html') || await cache.match('/')
      if (appShell) return appShell
    }
    return cached || new Response(JSON.stringify({ error: 'غير متصل' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function networkFirstNavigation(req, path) {
  try {
    const response = await fetch(req)
    console.log(`[SW] NETWORK ✓ ${path} (navigation)`)
    return response
  } catch {
    const cache = await caches.open(CACHE)
    const appShell = await cache.match('/index.html') || await cache.match('/')
    console.log(`[SW] OFFLINE → APP SHELL ${path}`)
    return appShell || new Response('غير متصل', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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
