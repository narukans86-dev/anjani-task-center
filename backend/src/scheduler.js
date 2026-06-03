'use strict'

const cron = require('node-cron')
const db = require('./database')
const { sendNotification, alreadySentToday, logReminder } = require('./utils/notificationService')

// ── Helpers ────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }

function getSettings() {
  return db.prepare('SELECT * FROM notification_settings WHERE id = 1').get() || {}
}

function getUserIdForStaff(staffId) {
  if (!staffId) return null
  const row = db.prepare('SELECT id FROM users WHERE staff_id = ? AND status = ?').get(staffId, 'active')
  return row ? row.id : null
}

function defaultSalesStaffId() {
  const settings = getSettings()
  if (settings.default_sales_staff_id) return settings.default_sales_staff_id
  // Fallback: find Rakesh by role
  const row = db.prepare(
    "SELECT id FROM staff WHERE LOWER(name) LIKE '%rakesh%' AND status='active' LIMIT 1"
  ).get()
  return row ? row.id : null
}

function defaultPurchaseStaffId() {
  const settings = getSettings()
  if (settings.default_purchase_staff_id) return settings.default_purchase_staff_id
  // Fallback: find Vakil by role
  const row = db.prepare(
    "SELECT id FROM staff WHERE LOWER(name) LIKE '%vakil%' AND status='active' LIMIT 1"
  ).get()
  return row ? row.id : null
}

// ── Refill morning reminders ────────────────────────────────────────────────

async function sendRefillReminders() {
  const date = today()
  const settings = getSettings()
  if (!settings.push_enabled) return

  const schedules = db.prepare(`
    SELECT * FROM refill_schedules
    WHERE scheduler_status = 'active' AND next_refill_date IS NOT NULL
  `).all()

  let sent = 0

  for (const s of schedules) {
    const refillTs = new Date(s.next_refill_date + 'T00:00:00Z').getTime()
    const todayTs  = new Date(date + 'T00:00:00Z').getTime()
    const daysUntil = Math.round((refillTs - todayTs) / 86400000)
    const token = s.token_id || `SCHED-${s.id}`
    const actionUrl = `/patient-refills?token=${token}`

    // Sales reminder (Rakesh or assigned sales staff)
    const salesStaffId = s.assigned_sales_staff_id || defaultSalesStaffId()
    const salesUserId  = getUserIdForStaff(salesStaffId)

    // Purchase reminder (Vakil or assigned purchase staff)
    const purchaseStaffId = s.assigned_purchase_staff_id || defaultPurchaseStaffId()
    const purchaseUserId  = getUserIdForStaff(purchaseStaffId)

    // Overdue
    if (daysUntil < 0) {
      const key = `refill:overdue:${s.id}:${date}`
      if (!alreadySentToday(key)) {
        await sendNotification({
          userId: salesUserId, staffId: salesStaffId,
          title: `Overdue Refill: ${s.patient_name} (${token})`,
          message: `Refill was due on ${s.next_refill_date} — ${Math.abs(daysUntil)} day(s) overdue. Take action now.`,
          type: 'refill', priority: 'urgent',
          requiresAction: true, clearable: false,
          relatedModule: 'patient_refill', relatedEntityId: s.id, relatedToken: token,
          actionUrl, dedupKey: key,
        })
        logReminder(key, 'patient_refill', s.id, salesStaffId, salesUserId)
        sent++
      }
    }

    // Due today — dispatch
    if (daysUntil === 0) {
      const key = `refill:dispatch:${s.id}:${date}`
      if (!alreadySentToday(key)) {
        await sendNotification({
          userId: salesUserId, staffId: salesStaffId,
          title: `Dispatch Today: ${s.patient_name} (${token})`,
          message: s.delivery_mode === 'Shiprocket'
            ? `Shiprocket dispatch required for ${s.patient_name} today.`
            : `Dispatch medicines to ${s.patient_name} today.`,
          type: 'refill', priority: 'urgent',
          requiresAction: true, clearable: false,
          relatedModule: 'patient_refill', relatedEntityId: s.id, relatedToken: token,
          actionUrl, dedupKey: key,
        })
        logReminder(key, 'patient_refill', s.id, salesStaffId, salesUserId)
        sent++
      }
    }

    // Due in 1-2 days — sales call reminder
    if (daysUntil >= 1 && daysUntil <= 2) {
      const key = `refill:sales_call:${s.id}:${date}`
      if (!alreadySentToday(key)) {
        await sendNotification({
          userId: salesUserId, staffId: salesStaffId,
          title: `Call Patient: ${s.patient_name} (${token})`,
          message: `Call ${s.patient_name} for refill confirmation. Refill due on ${s.next_refill_date}.`,
          type: 'refill', priority: 'high',
          requiresAction: true, clearable: false,
          relatedModule: 'patient_refill', relatedEntityId: s.id, relatedToken: token,
          actionUrl, dedupKey: key,
        })
        logReminder(key, 'patient_refill', s.id, salesStaffId, salesUserId)
        sent++
      }
    }

    // Due in 3-5 days — purchase reorder
    if (daysUntil >= 3 && daysUntil <= 5) {
      const key = `refill:reorder:${s.id}:${date}`
      if (!alreadySentToday(key)) {
        await sendNotification({
          userId: purchaseUserId, staffId: purchaseStaffId,
          title: `Reorder Required: ${s.patient_name} (${token})`,
          message: `Order medicines for ${s.patient_name}. Refill due on ${s.next_refill_date}.`,
          type: 'refill', priority: 'high',
          requiresAction: true, clearable: false,
          relatedModule: 'patient_refill', relatedEntityId: s.id, relatedToken: token,
          actionUrl, dedupKey: key,
        })
        logReminder(key, 'patient_refill', s.id, purchaseStaffId, purchaseUserId)
        sent++
      }
    }

    // Due in 5-7 days — stock check
    if (daysUntil >= 5 && daysUntil <= 7) {
      const key = `refill:stock_check:${s.id}:${date}`
      if (!alreadySentToday(key)) {
        await sendNotification({
          userId: purchaseUserId, staffId: purchaseStaffId,
          title: `Stock Check: ${s.patient_name} (${token})`,
          message: `Check stock for ${s.patient_name}. Refill due on ${s.next_refill_date}.`,
          type: 'refill', priority: 'medium',
          requiresAction: true, clearable: false,
          relatedModule: 'patient_refill', relatedEntityId: s.id, relatedToken: token,
          actionUrl, dedupKey: key,
        })
        logReminder(key, 'patient_refill', s.id, purchaseStaffId, purchaseUserId)
        sent++
      }
    }
  }

  if (sent > 0) console.log(`[Scheduler] Sent ${sent} refill reminders.`)
}

// ── Task morning reminders ──────────────────────────────────────────────────

async function sendTaskReminders() {
  const date = today()
  const settings = getSettings()
  if (!settings.push_enabled) return

  // Overdue tasks
  const overdue = db.prepare(`
    SELECT t.*, s.id AS staff_db_id FROM tasks t
    LEFT JOIN staff s ON LOWER(t.assigned_to) = LOWER(s.name)
    WHERE t.due_date < ? AND t.status NOT IN ('completed','cancelled')
  `).all(date)

  for (const t of overdue) {
    const userId  = getUserIdForStaff(t.staff_db_id)
    const key = `task:overdue:${t.id}:${date}`
    if (alreadySentToday(key)) continue
    await sendNotification({
      userId, staffId: t.staff_db_id,
      title: `Overdue: ${t.title}`,
      message: `Task was due on ${t.due_date} and is still ${t.status}.`,
      type: 'task', priority: 'urgent',
      requiresAction: false, clearable: true,
      actionUrl: '/tasks', dedupKey: key,
    })
    logReminder(key, 'task', t.id, t.staff_db_id, userId)
  }

  // High priority due today
  const urgent = db.prepare(`
    SELECT t.*, s.id AS staff_db_id FROM tasks t
    LEFT JOIN staff s ON LOWER(t.assigned_to) = LOWER(s.name)
    WHERE t.due_date = ? AND t.priority IN ('urgent','high','critical') AND t.status = 'pending'
  `).all(date)

  for (const t of urgent) {
    const userId  = getUserIdForStaff(t.staff_db_id)
    const key = `task:urgent_due:${t.id}:${date}`
    if (alreadySentToday(key)) continue
    await sendNotification({
      userId, staffId: t.staff_db_id,
      title: `Due Today: ${t.title}`,
      message: `High-priority task is due today and still pending.`,
      type: 'task', priority: 'high',
      requiresAction: false, clearable: true,
      actionUrl: '/tasks', dedupKey: key,
    })
    logReminder(key, 'task', t.id, t.staff_db_id, userId)
  }
}

// ── Evening pending reminder ────────────────────────────────────────────────

async function sendEveningReminders() {
  const date = today()
  const settings = getSettings()
  if (!settings.push_enabled) return

  // Pending refills due within 3 days
  const pending = db.prepare(`
    SELECT rs.*, s.id AS sales_staff_db_id
    FROM refill_schedules rs
    LEFT JOIN staff s ON rs.assigned_sales_staff_id = s.id
    WHERE rs.scheduler_status='active'
      AND rs.next_refill_date IS NOT NULL
      AND julianday(rs.next_refill_date) - julianday(?) BETWEEN 0 AND 3
  `).all(date)

  for (const s of pending) {
    const salesStaffId = s.assigned_sales_staff_id || defaultSalesStaffId()
    const salesUserId  = getUserIdForStaff(salesStaffId)
    const token = s.token_id || `SCHED-${s.id}`
    const key = `refill:evening:${s.id}:${date}`
    if (alreadySentToday(key)) continue
    await sendNotification({
      userId: salesUserId, staffId: salesStaffId,
      title: `Pending Refill: ${s.patient_name} (${token})`,
      message: `Refill for ${s.patient_name} is due on ${s.next_refill_date}. Ensure follow-up is complete.`,
      type: 'refill', priority: 'high',
      requiresAction: false, clearable: true,
      relatedModule: 'patient_refill', relatedEntityId: s.id, relatedToken: token,
      actionUrl: `/patient-refills?token=${token}`, dedupKey: key,
    })
    logReminder(key, 'patient_refill', s.id, salesStaffId, salesUserId)
  }
}

// ── Register all cron jobs ──────────────────────────────────────────────────

function startScheduler() {
  // Every 15 minutes — urgent/overdue check
  cron.schedule('*/15 * * * *', async () => {
    try { await sendRefillReminders() } catch (e) { console.error('[Scheduler] Refill error:', e.message) }
  }, { scheduled: false })

  // 9:30 AM daily — morning reminders (IST = UTC+5:30, so 4:00 UTC)
  cron.schedule('0 4 * * *', async () => {
    console.log('[Scheduler] Morning reminders running...')
    try { await sendRefillReminders() } catch (e) { console.error('[Scheduler] Morning refill error:', e.message) }
    try { await sendTaskReminders()   } catch (e) { console.error('[Scheduler] Morning task error:', e.message) }
  })

  // 5:00 PM IST (11:30 UTC) — evening pending check
  cron.schedule('30 11 * * *', async () => {
    console.log('[Scheduler] Evening reminders running...')
    try { await sendEveningReminders() } catch (e) { console.error('[Scheduler] Evening error:', e.message) }
  })

  // 8:30 PM IST (15:00 UTC) — end-of-day pending
  cron.schedule('0 15 * * *', async () => {
    console.log('[Scheduler] End-of-day reminders running...')
    try { await sendTaskReminders() } catch (e) { console.error('[Scheduler] End-of-day error:', e.message) }
  })

  console.log('[Scheduler] Notification scheduler started (morning 9:30, evening 17:00, EOD 20:30 IST).')
}

module.exports = { startScheduler, sendRefillReminders, sendTaskReminders }
