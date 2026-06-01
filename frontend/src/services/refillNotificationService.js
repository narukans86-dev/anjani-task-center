import { getSettings } from './storage'
import { generateRefillNotifications } from './api'

// ── WhatsApp / SMS message templates (future use) ──────────────────────────
// These are prepared for future integration. Do not send externally yet.

export const REFILL_MESSAGE_TEMPLATES = {
  stock_check: (patient, date) =>
    `Patient ${patient} refill due on ${date}. Start stock check today.`,

  reorder: (patient, date) =>
    `Reorder required for Patient ${patient} medicines. Refill on ${date}.`,

  verify_purchase: (patient, date) =>
    `Purchase team: Verify medicine availability for Patient ${patient}. Refill on ${date}.`,

  patient_call: (patient, date) =>
    `Sales team: Call Patient ${patient} for refill confirmation. Refill on ${date}.`,

  dispatch: (patient, date) =>
    `Dispatch medicines to Patient ${patient} today (${date}).`,

  dispatch_shiprocket: (patient, date) =>
    `Shiprocket dispatch required for Patient ${patient}. Refill date: ${date}.`,

  overdue: (patient, date, days) =>
    `OVERDUE: Patient ${patient} refill was due on ${date} and is ${days} day(s) overdue. Urgent action required.`,

  critical_stock: (patient, daysLeft) =>
    `CRITICAL: Refill for Patient ${patient} is in ${daysLeft} day(s) but stock has NOT been verified yet!`,
}

// ── Trigger refill notifications via backend ───────────────────────────────

let _lastRunDate = null

/**
 * Call once per session (or periodically) to generate refill workflow
 * notifications for all active schedules. Skips if setting is disabled
 * or already ran today.
 */
export async function triggerRefillNotifications({ force = false } = {}) {
  const settings = getSettings()
  if (!settings.refillSchedulerNotificationsEnabled) return

  const today = new Date().toISOString().slice(0, 10)
  if (!force && _lastRunDate === today) return

  try {
    const result = await generateRefillNotifications()
    _lastRunDate = today
    return result
  } catch {
    // non-critical — silently ignore
  }
}
