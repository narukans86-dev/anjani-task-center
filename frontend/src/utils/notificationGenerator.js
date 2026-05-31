import { generateNotifications } from '../services/api'

export async function generateTaskNotifications(tasks) {
  if (!tasks || tasks.length === 0) return
  try {
    await generateNotifications()
  } catch {
    // silently ignore — non-critical
  }
}

export async function generateChecklistNotifications(stats) {
  if (!stats) return
  const hour = new Date().getHours()

  const { opening, closing } = stats
  const openingPct = opening.total > 0 ? opening.completed / opening.total : 1
  const closingPct = closing.total > 0 ? closing.completed / closing.total : 1

  if (hour >= 10 && openingPct < 1) {
    try { await generateNotifications() } catch { /* silent */ }
    return
  }
  if (hour >= 20 && closingPct < 1) {
    try { await generateNotifications() } catch { /* silent */ }
  }
}
