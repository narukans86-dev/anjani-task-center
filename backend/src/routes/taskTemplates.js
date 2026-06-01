'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

// GET /api/task-templates — all templates
router.get('/', (req, res) => {
  const { active } = req.query
  let sql = 'SELECT * FROM task_templates'
  const params = []
  if (active !== undefined) {
    sql += ' WHERE active = ?'
    params.push(active === 'true' || active === '1' ? 1 : 0)
  }
  sql += ' ORDER BY category, title'
  res.json(db.prepare(sql).all(...params))
})

// POST /api/task-templates — create a template
router.post('/', (req, res) => {
  const { title, description, category, priority, department, assigned_to, active } = req.body
  if (!title) return res.status(400).json({ error: 'Title is required.' })

  const info = db.prepare(`
    INSERT INTO task_templates (title, description, category, priority, department, assigned_to, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    description?.trim() ?? null,
    category?.trim() ?? null,
    priority ?? 'medium',
    department?.trim() ?? null,
    assigned_to ?? null,
    active ?? 1
  )

  res.status(201).json(db.prepare('SELECT * FROM task_templates WHERE id = ?').get(info.lastInsertRowid))
})

// PUT /api/task-templates/:id — update a template
router.put('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Template not found.' })

  const { title, description, category, priority, department, assigned_to, active } = req.body

  db.prepare(`
    UPDATE task_templates SET
      title = ?, description = ?, category = ?, priority = ?, department = ?, assigned_to = ?, active = ?, updated_at = (datetime('now'))
    WHERE id = ?
  `).run(
    title !== undefined ? title.trim() : existing.title,
    description !== undefined ? description?.trim() ?? null : existing.description,
    category !== undefined ? category?.trim() ?? null : existing.category,
    priority !== undefined ? priority : existing.priority,
    department !== undefined ? department?.trim() ?? null : existing.department,
    assigned_to !== undefined ? assigned_to : existing.assigned_to,
    active !== undefined ? active : existing.active,
    id
  )

  res.json(db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id))
})

// DELETE /api/task-templates/:id — soft delete
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Template not found.' })

  db.prepare("UPDATE task_templates SET active = 0 WHERE id = ?").run(id)
  res.json({ message: `Template "${existing.title}" deactivated.` })
})

module.exports = router
