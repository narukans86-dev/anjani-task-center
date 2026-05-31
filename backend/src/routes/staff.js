'use strict'

const express = require('express')
const db = require('../database')

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

// POST /api/staff — create staff
router.post('/', (req, res) => {
  const { name, role, department, color, status, mobile_number, email, whatsapp_number, notification_preference } = req.body
  if (!name) return res.status(400).json({ error: 'name is required.' })
  if (!mobile_number) return res.status(400).json({ error: 'mobile_number is required.' })
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Invalid email format.' })

  const info = db.prepare(
    'INSERT INTO staff (name, role, department, color, status, mobile_number, email, whatsapp_number, notification_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name.trim(),
    role?.trim() ?? null,
    department?.trim() ?? null,
    color?.trim() ?? '#3b82f6',
    status ?? 'active',
    mobile_number.trim(),
    email?.trim() ?? null,
    whatsapp_number?.trim() ?? null,
    notification_preference ?? 'App'
  )

  const created = db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(created)
})

// PUT /api/staff/:id — update staff
router.put('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Staff member not found.' })

  const { name, role, department, color, status, mobile_number, email, whatsapp_number, notification_preference } = req.body
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Invalid email format.' })

  db.prepare(
    'UPDATE staff SET name=?, role=?, department=?, color=?, status=?, mobile_number=?, email=?, whatsapp_number=?, notification_preference=? WHERE id=?'
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
    id
  )

  res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(id))
})

// DELETE /api/staff/:id — soft delete (set status='inactive')
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Staff member not found.' })

  db.prepare("UPDATE staff SET status='inactive' WHERE id=?").run(id)
  res.json({ message: `Staff member "${existing.name}" set to inactive.` })
})

module.exports = router
