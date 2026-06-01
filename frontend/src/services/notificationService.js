const PREFERENCE_META = {
  App:       { label: 'App',       icon: '🔔', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  WhatsApp:  { label: 'WhatsApp',  icon: '💬', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  Email:     { label: 'Email',     icon: '✉️',  color: 'bg-blue-50 text-blue-600 border-blue-200' },
  SMS:       { label: 'SMS',       icon: '📱', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  None:      { label: 'None',      icon: '🔕', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export function getPreferenceLabel(preference) {
  return PREFERENCE_META[preference]?.label ?? preference ?? 'App'
}

export function getPreferenceIcon(preference) {
  return PREFERENCE_META[preference]?.icon ?? '🔔'
}

export function getPreferenceColor(preference) {
  return PREFERENCE_META[preference]?.color ?? PREFERENCE_META.App.color
}

export function sendNotification(staff, message, type = 'general') {
  const preference = staff.notification_preference ?? 'App'
  console.log(`[NOTIFICATION] -> ${staff.name} via ${preference}: ${message}`)
  // This is a placeholder for future external notification systems (WhatsApp, SMS, Email)
  // For now, it only logs to console.
  return { sent: false, reason: 'Not implemented yet', preference }
}

// --- Browser Push-Style Local Notifications ---

const BROWSER_NOTIFICATION_PERMISSION_KEY = 'browserNotificationPermission'

export function getBrowserNotificationPermission() {
  return localStorage.getItem(BROWSER_NOTIFICATION_PERMISSION_KEY) || 'default'
}

export function setBrowserNotificationPermission(permission) {
  localStorage.setItem(BROWSER_NOTIFICATION_PERMISSION_KEY, permission)
}

export async function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications.')
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()
  setBrowserNotificationPermission(permission)
  return permission
}

export function showBrowserNotification(title, message, options = {}) {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications.')
    return
  }

  if (getBrowserNotificationPermission() === 'granted') {
    new Notification(title, { body: message, ...options })
  } else {
    console.warn('Browser notification permission not granted or blocked.')
  }
}

// Fallback message if browser blocks notifications
export function getBrowserNotificationFallbackMessage() {
  if (!('Notification' in window)) {
    return 'Your browser does not support desktop notifications.'
  }
  if (Notification.permission === 'denied') {
    return 'You have blocked desktop notifications. Please enable them in your browser settings.'
  }
  return 'Enable desktop notifications to get alerts even when app is in background.'
}
