'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

// ── Helpers ────────────────────────────────────────────────────────────────

function audit(action, entityId, details) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details)
       VALUES (?, 'refill_schedule', ?, ?)`
    ).run(action, entityId, typeof details === 'string' ? details : JSON.stringify(details))
  } catch {
    // non-fatal
  }
}

function getMedicines(scheduleId) {
  return db.prepare('SELECT * FROM refill_medicines WHERE refill_schedule_id = ?').all(scheduleId)
}

function replaceMedicines(scheduleId, medicines) {
  db.prepare('DELETE FROM refill_medicines WHERE refill_schedule_id = ?').run(scheduleId)
  if (!Array.isArray(medicines) || medicines.length === 0) return
  const ins = db.prepare(`
    INSERT INTO refill_medicines
      (refill_schedule_id, medicine_name, strength, quantity_required, preferred_brand, substitute_allowed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const tx = db.transaction((rows) => {
    for (const m of rows) {
      ins.run(
        scheduleId,
        m.medicineName ?? m.medicine_name,
        m.strength ?? null,
        m.quantityRequired ?? m.quantity_required ?? 1,
        m.preferredBrand ?? m.preferred_brand ?? null,
        m.substituteAllowed ?? m.substitute_allowed ?? 0,
        m.notes ?? null,
      )
    }
  })
  tx(medicines)
}

function attachMedicines(row) {
  return { ...row, medicines: getMedicines(row.id) }
}

// ── GET /api/refill-schedules ──────────────────────────────────────────────
// Query: ?status= &priority= &patientType= &search= &staffId= &dueDate=

router.get('/', (req, res) => {
  const { status, priority, patientType, search, staffId, dueDate } = req.query

  let sql = 'SELECT * FROM refill_schedules WHERE 1=1'
  const params = []

  if (status)      { sql += ' AND scheduler_status = ?';            params.push(status) }
  if (priority)    { sql += ' AND priority = ?';                    params.push(priority) }
  if (patientType) { sql += ' AND patient_type = ?';                params.push(patientType) }
  if (search)      { sql += ' AND patient_name LIKE ?';             params.push(`%${search}%`) }
  if (staffId)     { sql += ' AND (assigned_sales_staff_id = ? OR assigned_purchase_staff_id = ?)'; params.push(staffId, staffId) }
  if (dueDate)     { sql += ' AND next_refill_date = ?';            params.push(dueDate) }

  sql += ' ORDER BY next_refill_date ASC, created_at DESC'

  const rows = db.prepare(sql).all(...params).map(attachMedicines)
  res.json({ total: rows.length, data: rows })
})

// ── GET /api/refill-schedules/upcoming — due within N days ────────────────

router.get('/upcoming', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days ?? 7, 10)))
  const today = new Date().toISOString().slice(0, 10)
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  const rows = db.prepare(`
    SELECT * FROM refill_schedules
    WHERE scheduler_status = 'active'
      AND next_refill_date BETWEEN ? AND ?
    ORDER BY next_refill_date ASC
  `).all(today, until).map(attachMedicines)

  res.json({ total: rows.length, data: rows })
})

// ── GET /api/refill-schedules/:id ─────────────────────────────────────────

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  res.json(attachMedicines(row))
})

// ── POST /api/refill-schedules ────────────────────────────────────────────

router.post('/', (req, res) => {
  const {
    patientName, patientMobile, patientWhatsapp, patientEmail, patientAddress,
    patientType, refillDate, refillFrequency, customIntervalDays,
    assignedSalesStaffId, assignedPurchaseStaffId, assignedPurchaseManagerId,
    deliveryMode, schedulerStatus, workflowStatus, priority,
    startReminderDaysBefore, notes, nextRefillDate,
    medicines,
  } = req.body

  if (!patientName) return res.status(400).json({ error: 'patientName is required.' })

  const info = db.prepare(`
    INSERT INTO refill_schedules (
      patient_name, patient_mobile, patient_whatsapp, patient_email, patient_address,
      patient_type, refill_date, refill_frequency, custom_interval_days,
      assigned_sales_staff_id, assigned_purchase_staff_id, assigned_purchase_manager_id,
      delivery_mode, scheduler_status, workflow_status, priority,
      start_reminder_days_before, notes, next_refill_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientName, patientMobile ?? null, patientWhatsapp ?? null, patientEmail ?? null, patientAddress ?? null,
    patientType ?? 'regular', refillDate ?? null, refillFrequency ?? 'monthly', customIntervalDays ?? null,
    assignedSalesStaffId ?? null, assignedPurchaseStaffId ?? null, assignedPurchaseManagerId ?? null,
    deliveryMode ?? 'pickup', schedulerStatus ?? 'active', workflowStatus ?? 'pending', priority ?? 'medium',
    startReminderDaysBefore ?? 3, notes ?? null, nextRefillDate ?? refillDate ?? null,
  )

  const id = info.lastInsertRowid
  if (Array.isArray(medicines)) replaceMedicines(id, medicines)

  audit('CREATE', id, { patientName, medicines: medicines?.length ?? 0 })

  res.status(201).json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(id)))
})

// ── PUT /api/refill-schedules/:id ─────────────────────────────────────────

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  const {
    patientName, patientMobile, patientWhatsapp, patientEmail, patientAddress,
    patientType, refillDate, refillFrequency, customIntervalDays,
    assignedSalesStaffId, assignedPurchaseStaffId, assignedPurchaseManagerId,
    deliveryMode, schedulerStatus, workflowStatus, priority,
    startReminderDaysBefore, notes, lastProcessedDate, nextRefillDate,
    medicines,
  } = req.body

  db.prepare(`
    UPDATE refill_schedules SET
      patient_name                = ?,
      patient_mobile              = ?,
      patient_whatsapp            = ?,
      patient_email               = ?,
      patient_address             = ?,
      patient_type                = ?,
      refill_date                 = ?,
      refill_frequency            = ?,
      custom_interval_days        = ?,
      assigned_sales_staff_id     = ?,
      assigned_purchase_staff_id  = ?,
      assigned_purchase_manager_id= ?,
      delivery_mode               = ?,
      scheduler_status            = ?,
      workflow_status             = ?,
      priority                    = ?,
      start_reminder_days_before  = ?,
      notes                       = ?,
      last_processed_date         = ?,
      next_refill_date            = ?,
      updated_at                  = datetime('now')
    WHERE id = ?
  `).run(
    patientName              ?? row.patient_name,
    patientMobile            ?? row.patient_mobile,
    patientWhatsapp          ?? row.patient_whatsapp,
    patientEmail             ?? row.patient_email,
    patientAddress           ?? row.patient_address,
    patientType              ?? row.patient_type,
    refillDate               ?? row.refill_date,
    refillFrequency          ?? row.refill_frequency,
    customIntervalDays       ?? row.custom_interval_days,
    assignedSalesStaffId     ?? row.assigned_sales_staff_id,
    assignedPurchaseStaffId  ?? row.assigned_purchase_staff_id,
    assignedPurchaseManagerId?? row.assigned_purchase_manager_id,
    deliveryMode             ?? row.delivery_mode,
    schedulerStatus          ?? row.scheduler_status,
    workflowStatus           ?? row.workflow_status,
    priority                 ?? row.priority,
    startReminderDaysBefore  ?? row.start_reminder_days_before,
    notes                    ?? row.notes,
    lastProcessedDate        ?? row.last_processed_date,
    nextRefillDate           ?? row.next_refill_date,
    req.params.id,
  )

  if (Array.isArray(medicines)) replaceMedicines(req.params.id, medicines)

  audit('EDIT', req.params.id, { patientName: patientName ?? row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

// ── PATCH /api/refill-schedules/:id/pause ─────────────────────────────────

router.patch('/:id/pause', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  if (row.scheduler_status === 'paused') return res.status(400).json({ error: 'Already paused.' })

  db.prepare(`UPDATE refill_schedules SET scheduler_status='paused', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  audit('PAUSE', req.params.id, { previousStatus: row.scheduler_status })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

// ── PATCH /api/refill-schedules/:id/resume ────────────────────────────────

router.patch('/:id/resume', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  if (row.scheduler_status !== 'paused') return res.status(400).json({ error: 'Not paused.' })

  db.prepare(`UPDATE refill_schedules SET scheduler_status='active', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  audit('RESUME', req.params.id, { patientName: row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

// ── DELETE /api/refill-schedules/:id — soft cancel ────────────────────────

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  const hard = req.query.hard === 'true'

  if (hard) {
    db.prepare('DELETE FROM refill_schedules WHERE id = ?').run(req.params.id)
    audit('DELETE_HARD', req.params.id, { patientName: row.patient_name })
    return res.json({ message: 'Deleted permanently.' })
  }

  db.prepare(`UPDATE refill_schedules SET scheduler_status='cancelled', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  audit('CANCEL', req.params.id, { patientName: row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

module.exports = router
