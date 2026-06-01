'use strict'

const express = require('express')
const bcryptjs = require('bcryptjs')
const crypto  = require('crypto')
const db      = require('../database')

const router = express.Router()

function sanitize(user) {
  const { password_hash, session_token, ...safe } = user
  return safe
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

function writeAudit(action, entityId, userName, details) {
  db.prepare(
    'INSERT INTO audit_logs (action, entity_type, entity_id, user_name, details) VALUES (?, ?, ?, ?, ?)'
  ).run(action, 'auth', entityId ?? null, userName ?? null, details ?? null)
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' })
  }

  const user = db.prepare(`
    SELECT u.*, s.name AS staff_name
    FROM users u
    LEFT JOIN staff s ON s.id = u.staff_id
    WHERE u.username = ? COLLATE NOCASE
  `).get(username.trim())

  if (!user) {
    writeAudit('login_failed', null, username.trim(), `Login failed — user not found: ${username.trim()}`)
    return res.status(401).json({ error: 'Invalid username or password.' })
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Account is inactive. Contact your admin.' })
  }

  const valid = bcryptjs.compareSync(password, user.password_hash)
  if (!valid) {
    writeAudit('login_failed', user.id, user.display_name, `Login failed — wrong password for: ${user.username}`)
    return res.status(401).json({ error: 'Invalid username or password.' })
  }

  const token = generateToken()
  const now   = new Date().toISOString()
  db.prepare(
    'UPDATE users SET session_token = ?, last_login_at = ?, updated_at = ? WHERE id = ?'
  ).run(token, now, now, user.id)

  writeAudit('login_success', user.id, user.display_name, `User '${user.username}' logged in`)

  res.json({
    user: {
      ...sanitize(user),
      name: user.display_name || user.username,
      staffId: user.staff_id,
      staffName: user.staff_name ?? null,
      mustChangePassword: user.must_change_password === 1,
      token,
    },
  })
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (token) {
    const user = db.prepare('SELECT id, username, display_name FROM users WHERE session_token = ?').get(token)
    if (user) {
      db.prepare('UPDATE users SET session_token = NULL, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), user.id)
      writeAudit('logout', user.id, user.display_name, `User '${user.username}' logged out`)
    }
  }
  res.json({ message: 'Logged out.' })
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })

  const user = db.prepare(`
    SELECT u.*, s.name AS staff_name
    FROM users u
    LEFT JOIN staff s ON s.id = u.staff_id
    WHERE u.session_token = ? AND u.status = 'active'
  `).get(token)

  if (!user) return res.status(401).json({ error: 'Session expired. Please log in again.' })

  res.json({
    user: {
      ...sanitize(user),
      name: user.display_name || user.username,
      staffId: user.staff_id,
      staffName: user.staff_name ?? null,
      mustChangePassword: user.must_change_password === 1,
    },
  })
})

// PUT /api/auth/me/profile — update own profile
router.put('/me/profile', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })

  const user = db.prepare('SELECT * FROM users WHERE session_token = ? AND status = ?').get(token, 'active')
  if (!user) return res.status(401).json({ error: 'Session expired. Please log in again.' })

  const { display_name, mobile_number, whatsapp_number, email, notification_preference } = req.body || {}

  if (display_name !== undefined && !(display_name || '').trim()) {
    return res.status(400).json({ error: 'Display name cannot be empty.' })
  }

  if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email format.' })
  }

  const VALID_PREFS = ['App', 'WhatsApp', 'Email', 'SMS', 'None']
  if (notification_preference && !VALID_PREFS.includes(notification_preference)) {
    return res.status(400).json({ error: 'Invalid notification preference.' })
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE users SET
      display_name            = ?,
      mobile_number           = ?,
      whatsapp_number         = ?,
      email                   = ?,
      notification_preference = ?,
      updated_at              = ?
    WHERE id = ?
  `).run(
    (display_name || '').trim() || user.display_name,
    (mobile_number || '').trim() || null,
    (whatsapp_number || '').trim() || null,
    (email || '').trim() || null,
    notification_preference || user.notification_preference || 'App',
    now,
    user.id,
  )

  const updated = db.prepare(`
    SELECT u.*, s.name AS staff_name
    FROM users u
    LEFT JOIN staff s ON s.id = u.staff_id
    WHERE u.id = ?
  `).get(user.id)

  writeAudit('profile_updated', updated.id, updated.display_name,
    `User '${updated.username}' updated their profile`)

  res.json({
    user: {
      ...sanitize(updated),
      name: updated.display_name || updated.username,
      staffId: updated.staff_id,
      staffName: updated.staff_name ?? null,
      mustChangePassword: updated.must_change_password === 1,
    },
  })
})

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })

  const user = db.prepare('SELECT * FROM users WHERE session_token = ? AND status = ?').get(token, 'active')
  if (!user) return res.status(401).json({ error: 'Session expired. Please log in again.' })

  const { oldPassword, newPassword } = req.body || {}
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'oldPassword and newPassword are required.' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' })
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from current password.' })
  }

  if (!bcryptjs.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' })
  }

  const newHash = bcryptjs.hashSync(newPassword, 10)
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?
  `).run(newHash, new Date().toISOString(), user.id)

  writeAudit('password_changed', user.id, user.display_name, `User '${user.username}' changed their password`)

  res.json({ message: 'Password changed successfully.' })
})

module.exports = router
