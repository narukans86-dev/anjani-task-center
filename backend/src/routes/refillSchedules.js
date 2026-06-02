'use strict'

const express = require('express')
const db = require('../database')
const { generateWorkflowTasks } = require('../utils/refillWorkflow')

const router = express.Router()

// ── Helpers ────────────────────────────────────────────────────────────────

function audit(req, action, entityId, details) {
  try {
    const user = req?.currentUser?.username || 'system'
    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_name, details)
       VALUES (?, 'refill_schedule', ?, ?, ?)`
    ).run(action, entityId, user, typeof details === 'string' ? details : JSON.stringify(details))
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
  if (!row) return null
  return { ...row, medicines: getMedicines(row.id) }
}

function normalizeId(val) {
  if (val === 'all' || val === '' || val === undefined || val === 'null') return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function normalizeDate(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  return val
}

// ── GET /api/refill-schedules ──────────────────────────────────────────────
// Query: ?status= &priority= &patientType= &search= &staffId= &dueDate=

router.get('/', (req, res) => {
  const { status, priority, patientType, search, staffId, dueDate } = req.query
  const user = req.currentUser

  let sql = 'SELECT * FROM refill_schedules WHERE 1=1'
  const params = []

  // Staff visibility: Admin/Manager see all, Staff see only assigned
  const isStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isStaff && user.staff_id) {
    sql += ' AND (assigned_sales_staff_id = ? OR assigned_purchase_staff_id = ?)'
    params.push(user.staff_id, user.staff_id)
  } else if (staffId) {
    sql += ' AND (assigned_sales_staff_id = ? OR assigned_purchase_staff_id = ?)'
    params.push(staffId, staffId)
  }

  if (status)      { sql += ' AND scheduler_status = ?';            params.push(status) }
  if (priority)    { sql += ' AND priority = ?';                    params.push(priority) }
  if (patientType) { sql += ' AND patient_type = ?';                params.push(patientType) }
  if (search)      { sql += ' AND patient_name LIKE ?';             params.push(`%${search}%`) }
  if (dueDate)     { sql += ' AND next_refill_date = ?';            params.push(dueDate) }

  sql += ' ORDER BY next_refill_date ASC, created_at DESC'

  const rows = db.prepare(sql).all(...params).map(attachMedicines)
  res.json({ total: rows.length, data: rows })
})

// ── GET /api/refill-schedules/upcoming — due within N days ────────────────

router.get('/upcoming', (req, res) => {
  const user = req.currentUser
  const days = Math.min(90, Math.max(1, parseInt(req.query.days ?? 7, 10)))
  const today = new Date().toISOString().slice(0, 10)
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  let sql = `
    SELECT * FROM refill_schedules
    WHERE scheduler_status = 'active'
      AND next_refill_date BETWEEN ? AND ?
  `
  const params = [today, until]

  const isStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isStaff && user.staff_id) {
    sql += ' AND (assigned_sales_staff_id = ? OR assigned_purchase_staff_id = ?)'
    params.push(user.staff_id, user.staff_id)
  }

  sql += ' ORDER BY next_refill_date ASC'

  const rows = db.prepare(sql).all(...params).map(attachMedicines)
  res.json({ total: rows.length, data: rows })
})

// ── GET /api/refill-schedules/:id ─────────────────────────────────────────

router.get('/:id', (req, res) => {
  const user = req.currentUser
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  // Basic staff check
  const isStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isStaff && user.staff_id && row.assigned_sales_staff_id !== user.staff_id && row.assigned_purchase_staff_id !== user.staff_id) {
    return res.status(403).json({ error: 'Access denied to this schedule.' })
  }

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

  const sDate = normalizeDate(refillDate)
  const nDate = normalizeDate(nextRefillDate) || sDate

  const info = db.prepare(`
    INSERT INTO refill_schedules (
      patient_name, patient_mobile, patient_whatsapp, patient_email, patient_address,
      patient_type, refill_date, refill_frequency, custom_interval_days,
      assigned_sales_staff_id, assigned_purchase_staff_id, assigned_purchase_manager_id,
      delivery_mode, scheduler_status, workflow_status, priority,
      start_reminder_days_before, notes, next_refill_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientName,
    patientMobile   || null,
    patientWhatsapp || null,
    patientEmail    || null,
    patientAddress  || null,
    patientType     || 'regular',
    sDate,
    refillFrequency || 'monthly',
    customIntervalDays ? parseInt(customIntervalDays, 10) : null,
    normalizeId(assignedSalesStaffId),
    normalizeId(assignedPurchaseStaffId),
    normalizeId(assignedPurchaseManagerId),
    deliveryMode    || 'pickup',
    schedulerStatus || 'active',
    workflowStatus  || 'upcoming',
    priority        || 'medium',
    parseInt(startReminderDaysBefore ?? 3, 10),
    notes           || null,
    nDate,
  )

  const id = info.lastInsertRowid
  if (Array.isArray(medicines)) replaceMedicines(id, medicines)

  audit(req, 'CREATE', id, { patientName, medicines: medicines?.length ?? 0 })

  // Auto-generate workflow tasks if a refill date is set
  let workflowResult = null
  try {
    if (nDate) {
      workflowResult = generateWorkflowTasks(id)
    }
  } catch (err) {
    console.error('[refillWorkflow] generation failed:', err.message)
  }

  const created = attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(id))
  res.status(201).json({ ...created, _workflowTasks: workflowResult })
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

  const sDate = normalizeDate(refillDate) ?? row.refill_date
  const nDate = normalizeDate(nextRefillDate) ?? row.next_refill_date

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
    sDate,
    refillFrequency          ?? row.refill_frequency,
    customIntervalDays       ? parseInt(customIntervalDays, 10) : row.custom_interval_days,
    normalizeId(assignedSalesStaffId) ?? row.assigned_sales_staff_id,
    normalizeId(assignedPurchaseStaffId) ?? row.assigned_purchase_staff_id,
    normalizeId(assignedPurchaseManagerId) ?? row.assigned_purchase_manager_id,
    deliveryMode             ?? row.delivery_mode,
    schedulerStatus          ?? row.scheduler_status,
    workflowStatus           ?? row.workflow_status,
    priority                 ?? row.priority,
    parseInt(startReminderDaysBefore ?? row.start_reminder_days_before, 10),
    notes                    ?? row.notes,
    lastProcessedDate        ?? row.last_processed_date,
    nDate,
    req.params.id,
  )

  if (Array.isArray(medicines)) replaceMedicines(req.params.id, medicines)

  audit(req, 'EDIT', req.params.id, { patientName: patientName ?? row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

// ── PATCH /api/refill-schedules/:id/pause ─────────────────────────────────

router.patch('/:id/pause', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  if (row.scheduler_status === 'paused') return res.status(400).json({ error: 'Already paused.' })

  db.prepare(`UPDATE refill_schedules SET scheduler_status='paused', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  audit(req, 'PAUSE', req.params.id, { previousStatus: row.scheduler_status })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

// ── PATCH /api/refill-schedules/:id/resume ────────────────────────────────

router.patch('/:id/resume', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  if (row.scheduler_status !== 'paused') return res.status(400).json({ error: 'Not paused.' })

  db.prepare(`UPDATE refill_schedules SET scheduler_status='active', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  audit(req, 'RESUME', req.params.id, { patientName: row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

// ── PATCH /api/refill-schedules/:id/workflow-status ──────────────────────

const WORKFLOW_TRANSITIONS = {
  upcoming:             ['stock_check_pending'],
  stock_check_pending:  ['reorder_required', 'stock_available'],
  reorder_required:     ['reorder_placed'],
  reorder_placed:       ['stock_available'],
  stock_available:      ['patient_call_pending'],
  patient_call_pending: ['patient_confirmed', 'cancelled'],
  patient_confirmed:    ['dispatch_pending'],
  dispatch_pending:     ['dispatched'],
  dispatched:           ['delivered'],
}

router.patch('/:id/workflow-status', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  const { status, notes } = req.body ?? {}
  if (!status) return res.status(400).json({ error: 'status is required.' })

  const current = row.workflow_status
  const allowed = WORKFLOW_TRANSITIONS[current] ?? []

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition from '${current}' to '${status}'.`,
      allowed,
    })
  }

  db.prepare(`UPDATE refill_schedules SET workflow_status=?, updated_at=datetime('now') WHERE id=?`)
    .run(status, req.params.id)

  audit(req, 'WORKFLOW_STATUS_CHANGE', req.params.id, { from: current, to: status, notes: notes ?? null })

  // Advance linked workflow task status when relevant
  try {
    const TASK_STEP_FOR_STATUS = {
      stock_check_pending:  'stock_check',
      stock_available:      'verify_availability',
      patient_call_pending: 'patient_call',
      dispatched:           'dispatch',
    }
    const step = TASK_STEP_FOR_STATUS[status]
    if (step) {
      db.prepare(`
        UPDATE tasks SET status='in_progress', updated_at=datetime('now')
        WHERE patient_schedule_id=? AND workflow_step=? AND status='pending'
      `).run(req.params.id, step)
    }
    if (status === 'delivered' || status === 'cancelled') {
      db.prepare(`
        UPDATE tasks SET status=?, updated_at=datetime('now')
        WHERE patient_schedule_id=? AND status IN ('pending','in_progress')
      `).run(status === 'delivered' ? 'completed' : 'cancelled', req.params.id)
    }
  } catch { /* non-fatal */ }

  const updated = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  res.json({ ...updated, medicines: db.prepare('SELECT * FROM refill_medicines WHERE refill_schedule_id = ?').all(req.params.id) })
})

// ── GET /api/refill-schedules/:id/workflow-transitions ───────────────────

router.get('/:id/workflow-transitions', (req, res) => {
  const row = db.prepare('SELECT workflow_status FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  res.json({ current: row.workflow_status, allowed: WORKFLOW_TRANSITIONS[row.workflow_status] ?? [] })
})

// ── POST /api/refill-schedules/:id/generate-workflow ─────────────────────
// Manually (re-)trigger workflow task generation for a cycle.
// Pass { cycleDate: 'YYYY-MM-DD' } to override next_refill_date for the run.

router.post('/:id/generate-workflow', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  // Temporarily override next_refill_date in-memory if caller supplies a cycleDate
  const { cycleDate } = req.body ?? {}
  if (cycleDate) {
    db.prepare(`UPDATE refill_schedules SET next_refill_date=?, updated_at=datetime('now') WHERE id=?`)
      .run(cycleDate, req.params.id)
  }

  try {
    const result = generateWorkflowTasks(req.params.id)
    res.json({ message: 'Workflow tasks generated.', ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/refill-schedules/:id — soft cancel ────────────────────────

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  const hard = req.query.hard === 'true'

  if (hard) {
    db.prepare('DELETE FROM refill_schedules WHERE id = ?').run(req.params.id)
    audit(req, 'DELETE_HARD', req.params.id, { patientName: row.patient_name })
    return res.json({ message: 'Deleted permanently.' })
  }

  db.prepare(`UPDATE refill_schedules SET scheduler_status='cancelled', updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  audit(req, 'CANCEL', req.params.id, { patientName: row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

module.exports = router
