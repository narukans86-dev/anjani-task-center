'use strict'

const express  = require('express')
const bcryptjs = require('bcryptjs')
const db       = require('../database')

const router = express.Router()

function sanitize(user) {
  const { password_hash, session_token, ...safe } = user
  return safe
}

function writeAudit(action, entityId, actorName, details) {
  db.prepare(
    'INSERT INTO audit_logs (action, entity_type, entity_id, user_name, details) VALUES (?, ?, ?, ?, ?)'
  ).run(action, 'user', entityId ?? null, actorName ?? null, details ?? null)
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })
  const user = db.prepare('SELECT * FROM users WHERE session_token = ? AND status = ?').get(token, 'active')
  if (!user) return res.status(401).json({ error: 'Session expired.' })
  req.currentUser = user
  next()
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' })
    next()
  })
}

function withStaffName(user) {
  const s = user.staff_id ? db.prepare('SELECT name FROM staff WHERE id = ?').get(user.staff_id) : null
  return { ...sanitize(user), staff_name: s?.name ?? null }
}

// GET /api/users — list all (auth required; managers see list, admins see all)
router.get('/', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT u.*, s.name AS staff_name
    FROM users u
    LEFT JOIN staff s ON s.id = u.staff_id
    ORDER BY
      CASE u.role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END,
      u.display_name ASC
  `).all()
  res.json(rows.map(sanitize))
})

// POST /api/users — create (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { username, display_name, password, role, staff_id, mobile_number, email } = req.body || {}
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'username and password are required.' })
  }
  if (!['admin', 'manager', 'staff', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin, manager, staff, or viewer.' })
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username.trim())
  if (existing) return res.status(409).json({ error: 'Username already exists.' })

  const hash = bcryptjs.hashSync(password, 10)
  const now  = new Date().toISOString()

  const info = db.prepare(`
    INSERT INTO users (username, display_name, password_hash, role, staff_id, mobile_number, email, status, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
  `).run(
    username.trim(),
    display_name?.trim() || username.trim(),
    hash, role,
    staff_id || null,
    mobile_number?.trim() || null,
    email?.trim() || null,
    now, now,
  )

  const created = db.prepare(`
    SELECT u.*, s.name AS staff_name FROM users u
    LEFT JOIN staff s ON s.id = u.staff_id WHERE u.id = ?
  `).get(info.lastInsertRowid)

  writeAudit('user_created', created.id, req.currentUser.display_name,
    `User '${created.username}' (${created.role}) created by admin '${req.currentUser.username}'`)

  res.status(201).json(sanitize(created))
})

// PUT /api/users/:id — update (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const { display_name, role, staff_id, mobile_number, whatsapp_number, email, notification_preference, must_change_password } = req.body || {}
  if (role && !['admin', 'manager', 'staff', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' })
  }

  const VALID_PREFS = ['App', 'WhatsApp', 'Email', 'SMS', 'None']
  if (notification_preference && !VALID_PREFS.includes(notification_preference)) {
    return res.status(400).json({ error: 'Invalid notification preference.' })
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE users SET
      display_name            = COALESCE(?, display_name),
      role                    = COALESCE(?, role),
      staff_id                = ?,
      mobile_number           = COALESCE(?, mobile_number),
      whatsapp_number         = COALESCE(?, whatsapp_number),
      email                   = COALESCE(?, email),
      notification_preference = COALESCE(?, notification_preference),
      must_change_password    = COALESCE(?, must_change_password),
      updated_at              = ?
    WHERE id = ?
  `).run(
    display_name?.trim() || null,
    role || null,
    staff_id !== undefined ? (staff_id || null) : user.staff_id,
    mobile_number?.trim() || null,
    whatsapp_number?.trim() || null,
    email?.trim() || null,
    notification_preference || null,
    must_change_password !== undefined ? (must_change_password ? 1 : 0) : null,
    now,
    user.id,
  )

  const updated = db.prepare(`
    SELECT u.*, s.name AS staff_name FROM users u
    LEFT JOIN staff s ON s.id = u.staff_id WHERE u.id = ?
  `).get(user.id)

  writeAudit('user_edited', updated.id, req.currentUser.display_name,
    `User '${updated.username}' edited by admin '${req.currentUser.username}'`)

  res.json(sanitize(updated))
})

// PATCH /api/users/:id/reset-password — admin resets password
router.patch('/:id/reset-password', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const { newPassword } = req.body || {}
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'newPassword must be at least 4 characters.' })
  }

  const hash = bcryptjs.hashSync(newPassword, 10)
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 1, session_token = NULL, updated_at = ? WHERE id = ?
  `).run(hash, new Date().toISOString(), user.id)

  writeAudit('password_reset', user.id, req.currentUser.display_name,
    `Password for '${user.username}' reset by admin '${req.currentUser.username}'`)

  res.json({ message: `Password reset. '${user.username}' must change password on next login.` })
})

// PATCH /api/users/:id/status — activate / deactivate (admin only)
router.patch('/:id/status', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })
  if (user.id === req.currentUser.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account.' })
  }

  const { status } = req.body || {}
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or inactive.' })
  }

  db.prepare(`
    UPDATE users SET status = ?, session_token = NULL, updated_at = ? WHERE id = ?
  `).run(status, new Date().toISOString(), user.id)

  writeAudit(
    status === 'active' ? 'user_activated' : 'user_deactivated',
    user.id, req.currentUser.display_name,
    `User '${user.username}' ${status} by admin '${req.currentUser.username}'`,
  )

  res.json({ message: `User '${user.username}' is now ${status}.` })
})

module.exports = router
