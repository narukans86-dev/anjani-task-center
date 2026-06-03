/* Anjani Task Center — Service Worker */
/* Handles web push notifications. No aggressive caching — API data stays fresh. */

const APP_URL = self.location.origin

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── Push event ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Anjani Task Center', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Anjani Task Center'
  const options = {
    body: data.body || data.message || '',
    icon: '/brand/logo.png',
    badge: '/favicon.svg',
    tag: data.tag || 'anjani-notif-' + Date.now(),
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    data: {
      actionUrl: (data.data && data.data.actionUrl) || '/',
      notificationId: (data.data && data.data.notificationId) || null,
      relatedModule: (data.data && data.data.relatedModule) || null,
      requiresAction: (data.data && data.data.requiresAction) || false,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.actionUrl)
    ? APP_URL + event.notification.data.actionUrl
    : APP_URL

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if already open
        for (const client of windowClients) {
          if ('focus' in client) {
            if (targetUrl !== APP_URL) {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
