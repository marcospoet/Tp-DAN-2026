const CACHE = 'budgetbuddy-v4'

// App shell to pre-cache
const SHELL = ['/', '/manifest.json', '/icon.svg', '/icon-maskable.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== location.origin) return

  // Skip Next.js HMR and API routes
  if (url.pathname.startsWith('/_next/webpack-hmr')) return
  if (url.pathname.startsWith('/api/')) return

  // Navigation: network-first, fallback to cached root
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    )
    return
  }

  // Static assets (_next/static): cache-first
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          const resClone = res.clone()
          caches.open(CACHE).then((c) => c.put(event.request, resClone))
          return res
        })
      })
    )
  }
})
