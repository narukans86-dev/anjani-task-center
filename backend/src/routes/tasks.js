'use strict'

const express = require('express')
const db = require('../database')
const { sendNotification } = require('../utils/notificationService')

const router = express.Router()

// Look up staff_id + user_id from a staff name string
function findUserByStaffName(name) {
  if (!name) return { staffId: null, userId: null }
  const staff = db.prepare(
    'SELECT id FROM staff WHERE LOWER(name) = LOWER(?) AND status = ?'
  ).get(name.trim(), 'active')
  if (!staff) return { staffId: null, userId: null }
  const user = db.prepare(
    'SELECT id FROM users WHERE staff_id = ? AND status = ?'
  ).get(staff.id, 'active')
  return { staffId: staff.id, userId: user ? user.id : null }
}

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

// GET /api/tasks/today — tasks due today (including recurring)
router.get('/today', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date(today + 'T00:00:00')
  const weekday = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]
  const dayOfMonth = d.getDate()

  const all = db.prepare('SELECT * FROM tasks WHERE status NOT IN (\'cancelled\')').all()

  const due = all.filter((t) => {
    if (!t.is_recurring) return t.due_date === today

    const type = t.recurrence_type || 'none'
    if (type === 'none') return t.due_date === today
    if (t.recurrence_end_date && today > t.recurrence_end_date) return false
    if (t.due_date && today < t.due_date) return false

    if (type === 'daily') return true

    if (type === 'weekly' || type === 'custom') {
      let days = []
      try { days = t.recurrence_days ? JSON.parse(t.recurrence_days) : [] } catch { days = [] }
      return days.includes(weekday)
    }

    if (type === 'monthly') {
      if (!t.due_date) return false
      return parseInt(t.due_date.slice(8, 10), 10) === dayOfMonth
    }

    return false
  })

  const priority_order = { critical: 1, urgent: 2, high: 3, medium: 4, low: 5 }
  due.sort((a, b) => (priority_order[a.priority] || 9) - (priority_order[b.priority] || 9))

  res.json(due)
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

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid)

  // Notify assigned staff immediately
  if (assigned_to) {
    const { staffId, userId } = findUserByStaffName(assigned_to)
    const assigner = req.currentUser?.display_name || req.currentUser?.username || 'Someone'
    const duePart = due_date ? ` · Due: ${due_date}` : ''
    sendNotification({
      userId, staffId,
      title: `New task assigned to you`,
      message: `"${title.trim()}" assigned by ${assigner}${duePart}.`,
      type: 'task',
      priority: ['critical','urgent'].includes(priority) ? 'urgent' : (priority || 'normal'),
      requiresAction: false,
      clearable: true,
      actionUrl: '/tasks',
    }).catch(() => {})
  }

  res.status(201).json(task)
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

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)

  // Notify if assignment changed (new assignee or reassigned to someone else)
  const prevAssignee = existing.assigned_to
  const newAssignee  = assigned_to !== undefined ? assigned_to : existing.assigned_to
  if (newAssignee && newAssignee !== prevAssignee) {
    const { staffId, userId } = findUserByStaffName(newAssignee)
    const assigner = req.currentUser?.display_name || req.currentUser?.username || 'Someone'
    const duePart  = updated.due_date ? ` · Due: ${updated.due_date}` : ''
    sendNotification({
      userId, staffId,
      title: `Task assigned to you`,
      message: `"${updated.title}" assigned by ${assigner}${duePart}.`,
      type: 'task',
      priority: ['critical','urgent'].includes(updated.priority) ? 'urgent' : (updated.priority || 'normal'),
      requiresAction: false,
      clearable: true,
      actionUrl: '/tasks',
    }).catch(() => {})
  }

  res.json(updated)
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
