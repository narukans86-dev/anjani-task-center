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
  return { sent: false, reason: 'Not implemented yet', preference }
}
