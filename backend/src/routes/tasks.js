'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

// GET /api/tasks — all tasks with optional filters
// Query: ?date=YYYY-MM-DD &status= &priority= &staff= &category= &search=
router.get('/', (req, res) => {
  const { date, status, priority, staff, category, search } = req.query

  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params = []

  if (date)     { sql += ' AND due_date = ?';                    params.push(date) }
  if (status)   { sql += ' AND status = ?';                      params.push(status) }
  if (priority) { sql += ' AND priority = ?';                    params.push(priority) }
  if (staff)    { sql += ' AND assigned_to = ?';                 params.push(staff) }
  if (category) { sql += ' AND category = ?';                    params.push(category) }
  if (search)   { sql += ' AND title LIKE ?';                    params.push(`%${search}%`) }

  sql += ' ORDER BY created_at DESC'

  res.json(db.prepare(sql).all(...params))
})

// GET /api/tasks/today — tasks where due_date = today
router.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const rows = db.prepare(
    "SELECT * FROM tasks WHERE due_date = ? ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END"
  ).all(today)
  res.json(rows)
})

// GET /api/tasks/stats — counts: total, completed, pending, delayed, by_category, by_staff
router.get('/stats', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)

  const total     = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n
  const completed = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status='completed'").get().n
  const pending   = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status='pending'").get().n
  const delayed   = db.prepare(
    "SELECT COUNT(*) AS n FROM tasks WHERE due_date < ? AND status NOT IN ('completed','cancelled')"
  ).get(today).n

  const by_category = db.prepare(
    "SELECT category, COUNT(*) AS count FROM tasks WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC"
  ).all()

  const by_staff = db.prepare(
    "SELECT assigned_to, COUNT(*) AS count FROM tasks WHERE assigned_to IS NOT NULL GROUP BY assigned_to ORDER BY count DESC"
  ).all()

  res.json({ total, completed, pending, delayed, by_category, by_staff })
})

// POST /api/tasks — create task
router.post('/', (req, res) => {
  const { title, description, category, priority, status, assigned_to, due_date, due_time } = req.body
  if (!title) return res.status(400).json({ error: 'title is required.' })

  const info = db.prepare(`
    INSERT INTO tasks (title, description, category, priority, status, assigned_to, due_date, due_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    description?.trim() ?? null,
    category?.trim() ?? null,
    priority ?? 'medium',
    status ?? 'pending',
    assigned_to ?? null,
    due_date ?? null,
    due_time ?? null
  )

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid))
})

// PUT /api/tasks/:id — update task
router.put('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Task not found.' })

  const { title, description, category, priority, status, assigned_to, due_date, due_time } = req.body

  const newStatus = status !== undefined ? status : existing.status
  let completedAt = existing.completed_at
  if (newStatus === 'completed' && existing.status !== 'completed') {
    completedAt = new Date().toISOString()
  } else if (newStatus !== 'completed') {
    completedAt = null
  }

  db.prepare(`
    UPDATE tasks SET
      title=?, description=?, category=?, priority=?, status=?,
      assigned_to=?, due_date=?, due_time=?, completed_at=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    title !== undefined ? title.trim() : existing.title,
    description !== undefined ? description?.trim() ?? null : existing.description,
    category !== undefined ? category?.trim() ?? null : existing.category,
    priority !== undefined ? priority : existing.priority,
    newStatus,
    assigned_to !== undefined ? assigned_to : existing.assigned_to,
    due_date !== undefined ? due_date : existing.due_date,
    due_time !== undefined ? due_time : existing.due_time,
    completedAt,
    id
  )

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id))
})

// DELETE /api/tasks/:id — delete task
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Task not found.' })

  db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(id)
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  res.json({ message: `Task "${existing.title}" deleted.` })
})

// PATCH /api/tasks/:id/status — update only status, log to task_logs
router.patch('/:id/status', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Task not found.' })

  const { status, note } = req.body
  if (!status) return res.status(400).json({ error: 'status is required.' })

  let completedAt = existing.completed_at
  if (status === 'completed' && existing.status !== 'completed') {
    completedAt = new Date().toISOString()
  } else if (status !== 'completed') {
    completedAt = null
  }

  db.prepare(
    "UPDATE tasks SET status=?, completed_at=?, updated_at=datetime('now') WHERE id=?"
  ).run(status, completedAt, id)

  db.prepare(
    'INSERT INTO task_logs (task_id, action, note) VALUES (?, ?, ?)'
  ).run(id, `status_changed_to_${status}`, note ?? null)

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id))
})

module.exports = router
