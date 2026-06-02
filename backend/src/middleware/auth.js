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

// Allows admin OR standard decision_manager (role='manager', no special access_role).
// Blocks sales_manager (access_role='sales_manager') and staff.
function requireDecisionManagerOrAbove(req, res, next) {
  requireAuth(req, res, () => {
    const u = req.currentUser
    if (u.role === 'admin') return next()
    if (u.role === 'manager' && (!u.access_role || u.access_role === 'decision_manager')) return next()
    return res.status(403).json({ error: 'Manager or Admin access required.' })
  })
}

module.exports = { requireAuth, requireAdmin, requireDecisionManagerOrAbove }
