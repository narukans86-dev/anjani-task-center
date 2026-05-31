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

  res.json({ generated: created.length, ids: created })
})

module.exports = router
