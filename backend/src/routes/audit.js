'use strict'

const express = require('express')
const db = require('../database')
const { requireAdmin } = require('../middleware/auth')

const router = express.Router()

// GET /api/audit?page=1&limit=50 — admin only
router.get('/', requireAdmin, (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  ?? 1, 10))
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? 50, 10)))
  const offset = (page - 1) * limit

  const total = db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n
  const rows  = db.prepare(
    'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  ).all(limit, offset)

  res.json({ total, page, limit, data: rows })
})

// POST /api/audit
router.post('/', (req, res) => {
  const { action, entity_type, entity_id, user_name, details } = req.body
  if (!action) return res.status(400).json({ error: 'action is required.' })

  const info = db.prepare(`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_name, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(action, entity_type ?? null, entity_id ?? null, user_name ?? null, details ?? null)

  res.status(201).json(
    db.prepare('SELECT * FROM audit_logs WHERE id=?').get(info.lastInsertRowid)
  )
})

// DELETE /api/audit/clear — admin only
router.delete('/clear', requireAdmin, (_req, res) => {
  db.prepare('DELETE FROM audit_logs').run()
  res.json({ message: 'All audit logs cleared.' })
})

module.exports = router
