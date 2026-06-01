'use strict'

const db = require('../database')

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })
  const user = db.prepare('SELECT * FROM users WHERE session_token = ? AND status = ?').get(token, 'active')
  if (!user) return res.status(401).json({ error: 'Session expired. Please log in again.' })
  req.currentUser = user
  next()
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' })
    }
    next()
  })
}

module.exports = { requireAuth, requireAdmin }
