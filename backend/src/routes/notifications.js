'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

const today = () => new Date().toISOString().slice(0, 10)

// GET /api/notifications — all notifications, unread first
router.get('/', (_req, res) => {
  res.json(
    db.prepare('SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC').all()
  )
})

// GET /api/notifications/unread-count
router.get('/unread-count', (_req, res) => {
  const count = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE is_read=0").get().n
  res.json({ count })
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM notifications WHERE id=?').get(id)
  if (!existing) return res.status(404).json({ error: 'Notification not found.' })

  db.prepare("UPDATE notifications SET is_read=1 WHERE id=?").run(id)
  res.json(db.prepare('SELECT * FROM notifications WHERE id=?').get(id))
})

// PATCH /api/notifications/read-all
router.patch('/read-all', (_req, res) => {
  db.prepare("UPDATE notifications SET is_read=1 WHERE is_read=0").run()
  res.json({ message: 'All notifications marked as read.' })
})

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM notifications WHERE id=?').get(id)
  if (!existing) return res.status(404).json({ error: 'Notification not found.' })

  db.prepare('DELETE FROM notifications WHERE id=?').run(id)
  res.json({ message: 'Notification deleted.' })
})

// POST /api/notifications/generate — scan tasks and produce notifications
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

  // Incomplete checklists after working hours (after 19:00)
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
  const inactiveStaff = db.prepare(`
    SELECT id, name FROM staff
    WHERE status = 'inactive'
  `).all()

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
        'staff', 'medium', null, staff.id
      )
      created.push(info.lastInsertRowid)
    }
  }

  // System backup reminder (daily)
  const backupDupe = db.prepare(`
    SELECT id FROM notifications
    WHERE type='system' AND title LIKE 'System backup reminder%'
      AND date(created_at)=?
  `).get(date)
  if (!backupDupe) {
    const info = insert.run(
      'System backup reminder',
      'Remember to export your data for backup and safety.',
      'system', 'low', null, null
    )
    created.push(info.lastInsertRowid)
  }

  res.json({ generated: created.length, ids: created })
})

// POST /api/notifications/generate-refill — generate refill workflow notifications
router.post('/generate-refill', (_req, res) => {
  const date = today()

  const insertNotif = db.prepare(`
    INSERT OR IGNORE INTO notifications
      (title, message, type, priority, related_schedule_id, dedup_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const created = []
  const skipped = []

  // Fetch all active refill schedules
  const schedules = db.prepare(`
    SELECT * FROM refill_schedules WHERE scheduler_status = 'active'
  `).all()

  for (const s of schedules) {
    const refillDate = s.next_refill_date
    if (!refillDate) continue

    const name = s.patient_name
    const refillTs = new Date(refillDate + 'T00:00:00Z').getTime()
    const todayTs = new Date(date + 'T00:00:00Z').getTime()
    const daysUntil = Math.round((refillTs - todayTs) / 86400000)

    // Helper to emit one notification
    function emit(step, title, message, priority = 'medium') {
      const key = `refill:${s.id}:${step}:${refillDate}`
      const info = insertNotif.run(title, message, 'refill', priority, s.id, key)
      if (info.changes > 0) created.push(info.lastInsertRowid)
      else skipped.push(key)
    }

    // Stock check reminder — 7 days before
    if (daysUntil <= 7 && daysUntil >= 5) {
      emit('stock_check', `Stock Check: ${name}`,
        `Patient ${name} refill due on ${refillDate}. Start stock check today.`, 'high')
    }

    // Reorder reminder — 5 days before
    if (daysUntil <= 5 && daysUntil >= 3) {
      emit('reorder', `Reorder Required: ${name}`,
        `Reorder required for Patient ${name} medicines. Refill on ${refillDate}.`, 'high')
    }

    // Sales call reminder — 2 days before
    if (daysUntil <= 2 && daysUntil >= 1) {
      emit('patient_call', `Sales Call: ${name}`,
        `Sales team: Call Patient ${name} for refill confirmation. Refill on ${refillDate}.`, 'high')
    }

    // Dispatch reminder — on refill day
    if (daysUntil === 0) {
      const isShiprocket = s.delivery_mode === 'Shiprocket'
      emit('dispatch', `Dispatch: ${name}`,
        isShiprocket
          ? `Shiprocket dispatch required for Patient ${name}. Refill date: ${refillDate}.`
          : `Dispatch medicines to Patient ${name} today (${refillDate}).`,
        'urgent')
    }

    // Purchase verification reminder — 3 days before
    if (daysUntil <= 3 && daysUntil >= 2) {
      emit('verify_purchase', `Verify Purchase: ${name}`,
        `Purchase team: Verify medicine availability for Patient ${name}. Refill on ${refillDate}.`, 'medium')
    }

    // Overdue refill — past due date
    if (daysUntil < 0) {
      emit('overdue', `Overdue Refill: ${name}`,
        `Patient ${name} refill was due on ${refillDate} and is now ${Math.abs(daysUntil)} day(s) overdue.`, 'urgent')
    }

    // Critical warning — refill within 2 days and stock_check task still pending
    if (daysUntil <= 2 && daysUntil >= 0) {
      const stockTask = db.prepare(`
        SELECT id FROM tasks
        WHERE patient_schedule_id = ? AND workflow_step = 'stock_check'
          AND refill_cycle_key = ? AND status NOT IN ('completed','cancelled')
        LIMIT 1
      `).get(s.id, refillDate)
      if (stockTask) {
        emit('critical_stock', `⚠ Critical: Stock Not Verified — ${name}`,
          `Refill for Patient ${name} is in ${daysUntil} day(s) but stock has NOT been verified yet!`, 'urgent')
      }
    }
  }

  res.json({ generated: created.length, skipped: skipped.length, ids: created })
})

module.exports = router
