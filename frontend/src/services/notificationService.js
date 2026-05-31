const PREFERENCE_META = {
  App:       { label: 'App',       icon: '🔔', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  WhatsApp:  { label: 'WhatsApp',  icon: '💬', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  Email:     { label: 'Email',     icon: '✉️',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  SMS:       { label: 'SMS',       icon: '📱', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  None:      { label: 'None',      icon: '🔕', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
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
  console.log(`[NOTIFICATION] → ${staff.name} via ${preference}: ${message}`)
  return { sent: false, reason: 'Not implemented yet', preference }
}
