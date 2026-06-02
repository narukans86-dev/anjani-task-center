'use strict'

const express = require('express')
const db = require('../database')
const { requireAdmin } = require('../middleware/auth')

const router = express.Router()

const today = () => new Date().toISOString().slice(0, 10)

// GET /api/checklists?type=opening|closing
router.get('/', (req, res) => {
  const { type } = req.query
  let sql = 'SELECT * FROM checklists WHERE active = 1'
  const params = []
  if (type) { sql += ' AND type = ?'; params.push(type) }
  sql += ' ORDER BY type, order_index'
  res.json(db.prepare(sql).all(...params))
})

// GET /api/checklists/today — items with completion status for today
router.get('/today', (_req, res) => {
  const date = today()
  const rows = db.prepare(`
    SELECT c.*,
           cc.id         AS completion_id,
           cc.completed_by,
           cc.completed_at,
           cc.notes,
           CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END AS is_completed
    FROM checklists c
    LEFT JOIN checklist_completions cc
           ON cc.checklist_id = c.id AND cc.completed_date = ?
    WHERE c.active = 1
    ORDER BY c.type, c.order_index
  `).all(date)
  res.json(rows)
})

// GET /api/checklists/stats — today's opening/closing completion summary
router.get('/stats', (_req, res) => {
  const date = today()

  const stat = (type) => {
    const total = db.prepare(
      "SELECT COUNT(*) AS n FROM checklists WHERE active=1 AND type=?"
    ).get(type).n
    const completed = db.prepare(`
      SELECT COUNT(DISTINCT c.id) AS n
      FROM checklists c
      JOIN checklist_completions cc ON cc.checklist_id = c.id AND cc.completed_date = ?
      WHERE c.active=1 AND c.type=?
    `).get(date, type).n
    return { total, completed }
  }

  res.json({ opening: stat('opening'), closing: stat('closing') })
})

// POST /api/checklists/complete — mark an item complete for today
router.post('/complete', (req, res) => {
  const { checklist_id, staff_id, notes } = req.body
  if (!checklist_id) return res.status(400).json({ error: 'checklist_id is required.' })

  const date = today()

  const existing = db.prepare(
    'SELECT id FROM checklist_completions WHERE checklist_id=? AND completed_date=?'
  ).get(checklist_id, date)

  if (existing) return res.status(409).json({ error: 'Already completed today.' })

  const info = db.prepare(
    'INSERT INTO checklist_completions (checklist_id, completed_by, completed_date, notes) VALUES (?,?,?,?)'
  ).run(checklist_id, staff_id ?? null, date, notes ?? null)

  res.status(201).json(
    db.prepare('SELECT * FROM checklist_completions WHERE id=?').get(info.lastInsertRowid)
  )
})

// DELETE /api/checklists/complete/:id — unmark a completion
router.delete('/complete/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM checklist_completions WHERE id=?').get(id)
  if (!existing) return res.status(404).json({ error: 'Completion not found.' })

  db.prepare('DELETE FROM checklist_completions WHERE id=?').run(id)
  res.json({ message: 'Completion removed.' })
})

// ── Admin Management Routes ────────────────────────────────────────────────

// POST /api/checklists — create a new checklist definition (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { title, description, type, order_index, is_required, active } = req.body
  if (!title) return res.status(400).json({ error: 'Title is required.' })

  const info = db.prepare(`
    INSERT INTO checklists (title, description, type, order_index, is_required, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    description?.trim() ?? null,
    type ?? 'opening',
    order_index ?? 0,
    is_required ?? 1,
    active ?? 1
  )

  const created = db.prepare('SELECT * FROM checklists WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(created)
})

// PUT /api/checklists/:id — update a checklist definition (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM checklists WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Checklist definition not found.' })

  const { title, description, type, order_index, is_required, active } = req.body

  db.prepare(`
    UPDATE checklists SET
      title = ?, description = ?, type = ?, order_index = ?, is_required = ?, active = ?
    WHERE id = ?
  `).run(
    title !== undefined ? title.trim() : existing.title,
    description !== undefined ? description?.trim() ?? null : existing.description,
    type !== undefined ? type : existing.type,
    order_index !== undefined ? order_index : existing.order_index,
    is_required !== undefined ? is_required : existing.is_required,
    active !== undefined ? active : existing.active,
    id
  )

  res.json(db.prepare('SELECT * FROM checklists WHERE id = ?').get(id))
})

// DELETE /api/checklists/:id — deactivate a checklist definition (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM checklists WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Checklist definition not found.' })

  // Soft delete if there are completions, hard delete otherwise? 
  // For safety, let's just deactivate.
  db.prepare("UPDATE checklists SET active = 0 WHERE id = ?").run(id)
  res.json({ message: `Checklist item "${existing.title}" deactivated.` })
})

module.exports = router
