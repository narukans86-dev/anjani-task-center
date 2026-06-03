const API = '/api'

function getToken() {
  try {
    const raw = localStorage.getItem('anjani_user')
    return raw ? (JSON.parse(raw)?.token ?? null) : null
  } catch { return null }
}

async function apiFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

// ── VAPID public key ───────────────────────────────────────────────────────

let cachedVapidKey = null

export async function getVapidPublicKey() {
  if (cachedVapidKey) return cachedVapidKey
  try {
    const data = await apiFetch('/push/vapid-public-key')
    cachedVapidKey = data.key
    return data.key
  } catch {
    return null
  }
}

// ── Feature detection ──────────────────────────────────────────────────────

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

// ── Subscribe device ───────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function subscribeDevice() {
  if (!isPushSupported()) throw new Error('Push not supported on this browser.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission denied. Enable it in browser settings.'
        : 'Notification permission not granted.'
    )
  }

  const vapidKey = await getVapidPublicKey()
  if (!vapidKey) throw new Error('Push not configured on server.')

  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  const sub = subscription.toJSON()
  await apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.keys,
      userAgent: navigator.userAgent,
      deviceLabel: getDeviceLabel(),
    }),
  })

  return subscription
}

export async function unsubscribeDevice() {
  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  await apiFetch('/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}

export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch { return null }
}

export async function sendTestPush() {
  return apiFetch('/push/test', { method: 'POST' })
}

export async function getPushStatus() {
  return apiFetch('/push/status')
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getDeviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Device'
}
