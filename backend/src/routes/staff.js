'use strict'

const express = require('express')
const db = require('../database')
const { requireDecisionManagerOrAbove } = require('../middleware/auth')

const router = express.Router()

// GET /api/staff — all staff
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM staff ORDER BY name ASC').all()
  res.json(rows)
})

// GET /api/staff/:id — single staff
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Staff member not found.' })
  res.json(row)
})

// POST /api/staff — create staff (manager or admin)
router.post('/', requireDecisionManagerOrAbove, (req, res) => {
  const {
    name,
    role,
    department,
    color,
    status,
    mobile_number,
    email,
    whatsapp_number,
    notification_preference,
    timing,
    main_responsibility,
  } = req.body
  if (!name) return res.status(400).json({ error: 'name is required.' })
  if (!mobile_number) return res.status(400).json({ error: 'mobile_number is required.' })
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Invalid email format.' })

  const info = db.prepare(
    `INSERT INTO staff (
      name, role, department, color, status, mobile_number, email,
      whatsapp_number, notification_preference, timing, main_responsibility
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name.trim(),
    role?.trim() ?? null,
    department?.trim() ?? null,
    color?.trim() ?? '#3b82f6',
    status ?? 'active',
    mobile_number.trim(),
    email?.trim() ?? null,
    whatsapp_number?.trim() ?? null,
    notification_preference ?? 'App',
    timing?.trim() ?? null,
    main_responsibility?.trim() ?? null
  )

  const created = db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(created)
})

// PUT /api/staff/:id — update staff (manager or admin)
router.put('/:id', requireDecisionManagerOrAbove, (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Staff member not found.' })

  const {
    name,
    role,
    department,
    color,
    status,
    mobile_number,
    email,
    whatsapp_number,
    notification_preference,
    timing,
    main_responsibility,
  } = req.body
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Invalid email format.' })

  db.prepare(
    `UPDATE staff SET
      name=?, role=?, department=?, color=?, status=?, mobile_number=?,
      email=?, whatsapp_number=?, notification_preference=?,
      timing=?, main_responsibility=?
    WHERE id=?`
  ).run(
    name !== undefined ? name.trim() : existing.name,
    role !== undefined ? role?.trim() ?? null : existing.role,
    department !== undefined ? department?.trim() ?? null : existing.department,
    color !== undefined ? color?.trim() ?? existing.color : existing.color,
    status !== undefined ? status : existing.status,
    mobile_number !== undefined ? mobile_number?.trim() ?? null : existing.mobile_number ?? null,
    email !== undefined ? email?.trim() ?? null : existing.email ?? null,
    whatsapp_number !== undefined ? whatsapp_number?.trim() ?? null : existing.whatsapp_number ?? null,
    notification_preference !== undefined ? notification_preference : existing.notification_preference ?? 'App',
    timing !== undefined ? timing?.trim() ?? null : existing.timing ?? null,
    main_responsibility !== undefined ? main_responsibility?.trim() ?? null : existing.main_responsibility ?? null,
    id
  )

  res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(id))
})

// DELETE /api/staff/:id — soft delete (manager or admin)
router.delete('/:id', requireDecisionManagerOrAbove, (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Staff member not found.' })

  db.prepare("UPDATE staff SET status='inactive' WHERE id=?").run(id)
  res.json({ message: `Staff member "${existing.name}" set to inactive.` })
})

module.exports = router
