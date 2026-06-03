'use strict'

const express = require('express')
const db = require('../database')
const { sendNotification } = require('../utils/notificationService')

const router = express.Router()

const today = () => new Date().toISOString().slice(0, 10)

// Build WHERE clause for staff-visibility filtering
// Admin sees all; everyone else sees only global (target_staff_id IS NULL) + their own
function staffFilter(user) {
  if (!user || user.role === 'admin') return { clause: '', params: [] }
  if (!user.staff_id) return { clause: '', params: [] }
  return {
    clause: ' AND (target_staff_id IS NULL OR target_staff_id = ?)',
    params: [user.staff_id],
  }
}

// GET /api/notifications
router.get('/', (req, res) => {
  const { clause, params } = staffFilter(req.currentUser)
  res.json(
    db.prepare(
      `SELECT * FROM notifications WHERE 1=1${clause} ORDER BY is_read ASC, created_at DESC`
    ).all(...params)
  )
})

// GET /api/notifications/unread-count
router.get('/unread-count', (req, res) => {
  const { clause, params } = staffFilter(req.currentUser)
  const count = db.prepare(
    `SELECT COUNT(*) AS n FROM notifications WHERE is_read=0${clause}`
  ).get(...params).n
  res.json({ count })
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM notifications WHERE id=?').get(id)
  if (!existing) return res.status(404).json({ error: 'Notification not found.' })

  db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(id)
  res.json(db.prepare('SELECT * FROM notifications WHERE id=?').get(id))
})

// PATCH /api/notifications/read-all
router.patch('/read-all', (req, res) => {
  const { clause, params } = staffFilter(req.currentUser)
  db.prepare(`UPDATE notifications SET is_read=1 WHERE is_read=0${clause}`).run(...params)
  res.json({ message: 'All notifications marked as read.' })
})

// PATCH /api/notifications/:id/complete
router.patch('/:id/complete', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM notifications WHERE id=?').get(id)
  if (!existing) return res.status(404).json({ error: 'Notification not found.' })

  db.prepare(
    "UPDATE notifications SET action_completed=1, clearable=1, is_read=1 WHERE id=?"
  ).run(id)
  res.json(db.prepare('SELECT * FROM notifications WHERE id=?').get(id))
})

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM notifications WHERE id=?').get(id)
  if (!existing) return res.status(404).json({ error: 'Notification not found.' })

  // Block deletion of active required-action notifications
  if (existing.requires_action && !existing.action_completed) {
    return res.status(400).json({
      error: 'Complete the refill task before clearing this notification.',
      requires_action: true,
    })
  }

  db.prepare('DELETE FROM notifications WHERE id=?').run(id)
  res.json({ message: 'Notification deleted.' })
})

// POST /api/notifications/test-me — send a test to the current user
router.post('/test-me', async (req, res) => {
  const user = req.currentUser
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const result = await sendNotification({
      userId: user.id,
      staffId: user.staff_id,
      title: 'Test Notification',
      message: `Hello ${user.display_name || user.username}! In-app notifications are working.`,
      type: 'system',
      priority: 'normal',
      requiresAction: false,
      clearable: true,
      actionUrl: '/',
    })
    res.json({ success: true, notifId: result.notifId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications/generate
router.post('/generate', (_req, res) => {
  const date = today()
  const hour = new Date().getHours()

  const insert = db.prepare(`
    INSERT INTO notifications (title, message, type, priority, related_task_id)
    VALUES (?, ?, ?, ?, ?)
  `)

  const created = []

  // Overdue tasks
  const overdue = db.prepare(`
    SELECT * FROM tasks
    WHERE due_date < ? AND status NOT IN ('completed','cancelled')
  `).all(date)

  for (const t of overdue) {
    const dupe = db.prepare(`
      SELECT id FROM notifications
      WHERE related_task_id=? AND type='task' AND title LIKE 'Overdue%'
        AND date(created_at)=?
    `).get(t.id, date)
    if (!dupe) {
      const info = insert.run(
        `Overdue: ${t.title}`,
        `Task was due on ${t.due_date} and is still ${t.status}.`,
        'task', 'high', t.id
      )
      created.push(info.lastInsertRowid)
    }
  }

  // Critical/urgent pending tasks for today
  const urgent = db.prepare(`
    SELECT * FROM tasks
    WHERE due_date = ? AND priority IN ('urgent','high') AND status = 'pending'
  `).all(date)

  for (const t of urgent) {
    const dupe = db.prepare(`
      SELECT id FROM notifications
      WHERE related_task_id=? AND type='task' AND title LIKE 'Urgent%'
        AND date(created_at)=?
    `).get(t.id, date)
    if (!dupe) {
      const info = insert.run(
        `Urgent pending: ${t.title}`,
        `High-priority task is still pending today.`,
        'task', 'high', t.id
      )
      created.push(info.lastInsertRowid)
    }
  }

  // Incomplete checklists after working hours
  if (hour >= 19) {
    const incomplete = db.prepare(`
      SELECT c.type, COUNT(*) AS n
      FROM checklists c
      WHERE c.active=1
        AND c.id NOT IN (
          SELECT checklist_id FROM checklist_completions WHERE completed_date=?
        )
      GROUP BY c.type
    `).all(date)

    for (const row of incomplete) {
      const dupe = db.prepare(`
        SELECT id FROM notifications
        WHERE type='checklist' AND date(created_at)=? AND title LIKE ?
      `).get(date, `%${row.type}%`)
      if (!dupe) {
        const info = insert.run(
          `Incomplete ${row.type} checklist`,
          `${row.n} item(s) in the ${row.type} checklist were not completed today.`,
          'checklist', 'medium', null
        )
        created.push(info.lastInsertRowid)
      }
    }
  }

  // Staff inactive
  const inactiveStaff = db.prepare(`SELECT id, name FROM staff WHERE status = 'inactive'`).all()
  for (const staff of inactiveStaff) {
    const dupe = db.prepare(`
      SELECT id FROM notifications
      WHERE related_staff_id=? AND type='staff' AND title LIKE 'Inactive staff%'
        AND date(created_at)=?
    `).get(staff.id, date)
    if (!dupe) {
      const info = insert.run(
        `Inactive staff: ${staff.name}`,
        `${staff.name} is currently marked as inactive.`,
        'staff', 'medium', null
      )
      created.push(info.lastInsertRowid)
    }
  }

  // System backup reminder
  const backupDupe = db.prepare(`
    SELECT id FROM notifications
    WHERE type='system' AND title LIKE 'System backup reminder%' AND date(created_at)=?
  `).get(date)
  if (!backupDupe) {
    const info = insert.run(
      'System backup reminder',
      'Remember to export your data for backup and safety.',
      'system', 'low', null
    )
    created.push(info.lastInsertRowid)
  }

  res.json({ generated: created.length, ids: created })
})

// POST /api/notifications/generate-refill
router.post('/generate-refill', (_req, res) => {
  const date = today()

  const insertNotif = db.prepare(`
    INSERT OR IGNORE INTO notifications
      (title, message, type, priority, related_schedule_id, dedup_key,
       requires_action, target_staff_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const created = []
  const skipped = []

  const schedules = db.prepare(`SELECT * FROM refill_schedules WHERE scheduler_status = 'active'`).all()

  for (const s of schedules) {
    const refillDate = s.next_refill_date
    if (!refillDate) continue

    const name = s.patient_name
    const token = s.token_id || `SCHED-${s.id}`
    const refillTs = new Date(refillDate + 'T00:00:00Z').getTime()
    const todayTs = new Date(date + 'T00:00:00Z').getTime()
    const daysUntil = Math.round((refillTs - todayTs) / 86400000)

    const emit = (step, title, message, priority = 'medium', requiresAction = false, targetStaffId = null) => {
      const key = `refill:${s.id}:${step}:${refillDate}`
      const info = insertNotif.run(title, message, 'refill', priority, s.id, key,
        requiresAction ? 1 : 0, targetStaffId)
      if (info.changes > 0) created.push(info.lastInsertRowid)
      else skipped.push(key)
    }

    // Stock check reminder — 7 days before → notify purchase staff
    if (daysUntil <= 7 && daysUntil >= 5) {
      emit('stock_check', `Stock Check: ${name} (${token})`,
        `Patient ${name} refill due on ${refillDate}. Start stock check today.`,
        'high', true, s.assigned_purchase_staff_id)
    }

    // Reorder reminder — 5 days before
    if (daysUntil <= 5 && daysUntil >= 3) {
      emit('reorder', `Reorder Required: ${name} (${token})`,
        `Reorder required for Patient ${name} medicines. Refill on ${refillDate}.`,
        'high', true, s.assigned_purchase_staff_id)
    }

    // Sales call reminder — 2 days before → notify sales staff
    if (daysUntil <= 2 && daysUntil >= 1) {
      emit('patient_call', `Sales Call: ${name} (${token})`,
        `Call Patient ${name} for refill confirmation. Refill on ${refillDate}.`,
        'high', true, s.assigned_sales_staff_id)
    }

    // Dispatch reminder — on refill day → notify sales staff (daily priority, non-clearable)
    if (daysUntil === 0) {
      const isShiprocket = s.delivery_mode === 'Shiprocket'
      emit('dispatch', `Dispatch: ${name} (${token})`,
        isShiprocket
          ? `Shiprocket dispatch required for Patient ${name}. Refill date: ${refillDate}.`
          : `Dispatch medicines to Patient ${name} today (${refillDate}).`,
        'urgent', true, s.assigned_sales_staff_id)
    }

    // Purchase verification — 3 days before
    if (daysUntil <= 3 && daysUntil >= 2) {
      emit('verify_purchase', `Verify Purchase: ${name} (${token})`,
        `Purchase team: Verify medicine availability for Patient ${name}. Refill on ${refillDate}.`,
        'medium', true, s.assigned_purchase_staff_id)
    }

    // Overdue refill
    if (daysUntil < 0) {
      emit('overdue', `Overdue Refill: ${name} (${token})`,
        `Patient ${name} refill was due on ${refillDate} and is now ${Math.abs(daysUntil)} day(s) overdue.`,
        'urgent', true, s.assigned_sales_staff_id)
    }

    // Critical warning — within 2 days and stock not verified
    if (daysUntil <= 2 && daysUntil >= 0) {
      const stockTask = db.prepare(`
        SELECT id FROM tasks
        WHERE patient_schedule_id = ? AND workflow_step = 'stock_check'
          AND refill_cycle_key = ? AND status NOT IN ('completed','cancelled')
        LIMIT 1
      `).get(s.id, refillDate)
      if (stockTask) {
        emit('critical_stock', `⚠ Critical: Stock Not Verified — ${name}`,
          `Refill for Patient ${name} is in ${daysUntil} day(s) but stock has NOT been verified yet! Token: ${token}`,
          'urgent', true, s.assigned_sales_staff_id)
      }
    }
  }

  res.json({ generated: created.length, skipped: skipped.length, ids: created })
})

module.exports = router
