'use strict'

const express = require('express')
const db = require('../database')
const { requireAdmin } = require('../middleware/auth')

const router = express.Router()

// GET /api/daily-routine/templates
// Admin → all templates. Non-admin → own staff_id + matching role/dept + global templates.
router.get('/templates', (req, res) => {
  const { active, routine_type } = req.query
  const currentUser = req.currentUser
  const isAdmin = currentUser.role === 'admin'

  let sql = 'SELECT * FROM daily_routine_templates'
  const conditions = []
  const params = []

  if (active !== undefined) {
    conditions.push('active = ?')
    params.push(active === 'true' || active === '1' ? 1 : 0)
  }
  if (routine_type !== undefined) {
    conditions.push('routine_type = ?')
    params.push(routine_type)
  }

  if (!isAdmin) {
    const staffId = currentUser.staff_id
    if (!staffId) {
      // No linked staff record — return only global (unassigned) templates
      conditions.push('(staff_id IS NULL AND staff_role IS NULL AND department IS NULL)')
    } else {
      const staffRecord = db.prepare('SELECT role, department FROM staff WHERE id = ?').get(staffId)
      // Always include: templates assigned to this staff_id
      const parts = ['staff_id = ?']
      const scopeParams = [staffId]
      // Include templates targeting this staff's role designation
      if (staffRecord?.role) {
        parts.push('LOWER(staff_role) = LOWER(?)')
        scopeParams.push(staffRecord.role)
      }
      // Include templates targeting this staff's department
      if (staffRecord?.department) {
        parts.push('LOWER(department) = LOWER(?)')
        scopeParams.push(staffRecord.department)
      }
      // Include global templates (Free Time board and any unassigned items)
      parts.push('(staff_id IS NULL AND staff_role IS NULL AND department IS NULL)')
      conditions.push(`(${parts.join(' OR ')})`)
      params.push(...scopeParams)
    }
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY display_order ASC, title ASC'
  res.json(db.prepare(sql).all(...params))
})

// POST /api/daily-routine/templates — create a template (admin only)
router.post('/templates', requireAdmin, (req, res) => {
  const { 
    staff_id, staff_role, department, title, description, 
    routine_type, priority, expected_time, estimated_minutes, 
    is_required, active, display_order 
  } = req.body

  if (!title) return res.status(400).json({ error: 'Title is required.' })

  const info = db.prepare(`
    INSERT INTO daily_routine_templates (
      staff_id, staff_role, department, title, description, 
      routine_type, priority, expected_time, estimated_minutes, 
      is_required, active, display_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    staff_id ?? null,
    staff_role?.trim() ?? null,
    department?.trim() ?? null,
    title.trim(),
    description?.trim() ?? null,
    routine_type ?? 'Full Day',
    priority ?? 'medium',
    expected_time ?? null,
    estimated_minutes ?? null,
    is_required ?? 1,
    active ?? 1,
    display_order ?? 0
  )

  res.status(201).json(db.prepare('SELECT * FROM daily_routine_templates WHERE id = ?').get(info.lastInsertRowid))
})

// PUT /api/daily-routine/templates/:id — update a template (admin only)
router.put('/templates/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM daily_routine_templates WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Template not found.' })

  const { 
    staff_id, staff_role, department, title, description, 
    routine_type, priority, expected_time, estimated_minutes, 
    is_required, active, display_order 
  } = req.body

  db.prepare(`
    UPDATE daily_routine_templates SET
      staff_id = ?, staff_role = ?, department = ?, title = ?, description = ?, 
      routine_type = ?, priority = ?, expected_time = ?, estimated_minutes = ?, 
      is_required = ?, active = ?, display_order = ?, updated_at = (datetime('now'))
    WHERE id = ?
  `).run(
    staff_id !== undefined ? staff_id : existing.staff_id,
    staff_role !== undefined ? staff_role?.trim() ?? null : existing.staff_role,
    department !== undefined ? department?.trim() ?? null : existing.department,
    title !== undefined ? title.trim() : existing.title,
    description !== undefined ? description?.trim() ?? null : existing.description,
    routine_type !== undefined ? routine_type : existing.routine_type,
    priority !== undefined ? priority : existing.priority,
    expected_time !== undefined ? expected_time : existing.expected_time,
    estimated_minutes !== undefined ? estimated_minutes : existing.estimated_minutes,
    is_required !== undefined ? is_required : existing.is_required,
    active !== undefined ? active : existing.active,
    display_order !== undefined ? display_order : existing.display_order,
    id
  )

  res.json(db.prepare('SELECT * FROM daily_routine_templates WHERE id = ?').get(id))
})

// DELETE /api/daily-routine/templates/:id — soft delete (admin only)
router.delete('/templates/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM daily_routine_templates WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Template not found.' })

  db.prepare("UPDATE daily_routine_templates SET active = 0 WHERE id = ?").run(id)
  res.json({ message: `Template "${existing.title}" deactivated.` })
})

module.exports = router
