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

function attachMedicines(row) {
  if (!row) return null
  return { ...row, medicines: getMedicines(row.id) }
}

function normalizeId(val) {
  if (val === 'all' || val === '' || val === undefined || val === 'null' || val === null) return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function normalizeDate(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  return val
}

// ── Token ID generator ────────────────────────────────────────────────────
// Format: REF-YYYYMMDD-XXXX (unique per day, sequential)

function generateTokenId() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const row = db.prepare(
    "SELECT token_id FROM refill_schedules WHERE token_id LIKE ? ORDER BY token_id DESC LIMIT 1"
  ).get(`REF-${today}-%`)
  let seq = 1
  if (row) {
    const parts = row.token_id.split('-')
    seq = parseInt(parts[parts.length - 1], 10) + 1
  }
  return `REF-${today}-${String(seq).padStart(4, '0')}`
}

// ── Insert notifications helper ───────────────────────────────────────────

const notifInsert = db.prepare(`
  INSERT OR IGNORE INTO notifications
    (title, message, type, priority, related_schedule_id, dedup_key,
     requires_action, action_completed, target_staff_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

function emitNotif(title, message, type, priority, scheduleId, dedupKey, requiresAction, targetStaffId) {
  try {
    notifInsert.run(title, message, type, priority, scheduleId, dedupKey,
      requiresAction ? 1 : 0, 0, targetStaffId ?? null)
  } catch {
    // non-fatal
  }
}

// ── Create refill workflow notifications on schedule creation ─────────────

function createRefillNotifications(scheduleId) {
  const s = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(scheduleId)
  if (!s) return

  const token = s.token_id || `SCHED-${scheduleId}`
  const refillDate = s.next_refill_date || s.refill_date || 'TBD'

  // Notify assigned sales staff (Rakesh) — requires action, non-clearable until done
  if (s.assigned_sales_staff_id) {
    emitNotif(
      `New Refill Scheduled: ${s.patient_name}`,
      `Refill scheduled (${token}). Check stock and confirm with patient by ${refillDate}. Delivery: ${s.delivery_mode || 'pickup'}.`,
      'refill', s.priority || 'medium', scheduleId,
      `refill:new:${scheduleId}:sales`,
      true, s.assigned_sales_staff_id
    )
  }

  // Notify assigned purchase staff — requires action for stock check
  if (s.assigned_purchase_staff_id) {
    emitNotif(
      `Stock Check Required: ${s.patient_name}`,
      `New refill (${token}) scheduled for ${refillDate}. Verify stock availability and alert sales team.`,
      'refill', s.priority || 'medium', scheduleId,
      `refill:new:${scheduleId}:purchase`,
      true, s.assigned_purchase_staff_id
    )
  }

  audit(null, 'NOTIFICATIONS_CREATED', scheduleId, { token, salesStaffId: s.assigned_sales_staff_id, purchaseStaffId: s.assigned_purchase_staff_id })
}

// ── GET /api/refill-schedules ──────────────────────────────────────────────

router.get('/', (req, res) => {
  const { status, priority, patientType, search, staffId, dueDate } = req.query
  const user = req.currentUser

  let sql = 'SELECT * FROM refill_schedules WHERE 1=1'
  const params = []

  // Staff visibility: Admin/Manager see all; regular Staff see only assigned
  const isRegularStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isRegularStaff && user.staff_id) {
    sql += ' AND (assigned_sales_staff_id = ? OR assigned_purchase_staff_id = ?)'
    params.push(user.staff_id, user.staff_id)
  } else if (staffId) {
    sql += ' AND (assigned_sales_staff_id = ? OR assigned_purchase_staff_id = ?)'
    params.push(staffId, staffId)
  }

  if (status)      { sql += ' AND scheduler_status = ?';  params.push(status) }
  if (priority)    { sql += ' AND priority = ?';           params.push(priority) }
  if (patientType) { sql += ' AND patient_type = ?';       params.push(patientType) }
  if (search)      { sql += ' AND patient_name LIKE ?';    params.push(`%${search}%`) }
  if (dueDate)     { sql += ' AND next_refill_date = ?';   params.push(dueDate) }

  sql += ' ORDER BY next_refill_date ASC, created_at DESC'

  const rows = db.prepare(sql).all(...params).map(attachMedicines)
  res.json({ total: rows.length, data: rows })
})

// ── GET /api/refill-schedules/upcoming ────────────────────────────────────

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

  const isRegularStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isRegularStaff && user.staff_id) {
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

  const isRegularStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isRegularStaff && user.staff_id &&
      row.assigned_sales_staff_id !== user.staff_id &&
      row.assigned_purchase_staff_id !== user.staff_id) {
    return res.status(403).json({ error: 'Access denied to this schedule.' })
  }

  res.json(attachMedicines(row))
})

// ── POST /api/refill-schedules ────────────────────────────────────────────
// Fully atomic: schedule + medicines in one transaction.
// Idempotent: clientRequestId prevents duplicates on retry.

router.post('/', (req, res) => {
  const {
    patientName, patientMobile, patientWhatsapp, patientEmail, patientAddress,
    patientType, refillDate, refillFrequency, customIntervalDays,
    assignedSalesStaffId, assignedPurchaseStaffId, assignedPurchaseManagerId,
    deliveryMode, schedulerStatus, workflowStatus, priority,
    startReminderDaysBefore, notes, nextRefillDate,
    medicines, clientRequestId,
  } = req.body

  // ── Validation ──────────────────────────────────────────────────────────
  if (!patientName || !patientName.trim()) {
    return res.status(400).json({ error: 'patientName is required.' })
  }
  if (!patientMobile && !patientWhatsapp) {
    return res.status(400).json({ error: 'At least mobile or WhatsApp number is required.' })
  }
  if (!refillDate && !nextRefillDate) {
    return res.status(400).json({ error: 'refillDate (start date) is required.' })
  }

  // Normalize and validate medicines — at least one with a name required
  const validMeds = Array.isArray(medicines)
    ? medicines.filter((m) => ((m.medicineName || m.medicine_name || '') + '').trim())
    : []
  if (validMeds.length === 0) {
    return res.status(400).json({ error: 'At least one medicine with a name is required.' })
  }

  const sDate = normalizeDate(refillDate)
  const nDate = normalizeDate(nextRefillDate) || sDate

  try {
    // ── Idempotency check + atomic save ────────────────────────────────────
    const doCreate = db.transaction(() => {
      // Return existing record if same client request is retried
      if (clientRequestId && clientRequestId.trim()) {
        const existing = db.prepare(
          'SELECT * FROM refill_schedules WHERE client_request_id = ?'
        ).get(clientRequestId.trim())
        if (existing) return { id: existing.id, isExisting: true }
      }

      const token = generateTokenId()

      const info = db.prepare(`
        INSERT INTO refill_schedules (
          patient_name, patient_mobile, patient_whatsapp, patient_email, patient_address,
          patient_type, refill_date, refill_frequency, custom_interval_days,
          assigned_sales_staff_id, assigned_purchase_staff_id, assigned_purchase_manager_id,
          delivery_mode, scheduler_status, workflow_status, priority,
          start_reminder_days_before, notes, next_refill_date,
          token_id, client_request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patientName.trim(),
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
        token,
        clientRequestId?.trim() || null,
      )

      const id = info.lastInsertRowid

      // Insert medicines atomically — medicine_name guaranteed non-null by validMeds filter
      const ins = db.prepare(`
        INSERT INTO refill_medicines
          (refill_schedule_id, medicine_name, strength, quantity_required,
           preferred_brand, substitute_allowed, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const m of validMeds) {
        const name = ((m.medicineName || m.medicine_name) + '').trim()
        const qty = parseInt(m.quantityRequired ?? m.quantity_required ?? 1, 10) || 1
        const subOk = m.substituteAllowed ?? m.substitute_allowed ?? false
        ins.run(
          id,
          name,
          m.strength || null,
          qty,
          m.preferredBrand || m.preferred_brand || null,
          subOk ? 1 : 0,
          m.notes || null,
        )
      }

      return { id, isExisting: false }
    })

    const { id, isExisting } = doCreate()

    if (isExisting) {
      // Idempotent return — same request was already processed
      const existing = attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(id))
      return res.status(200).json({ ...existing, _idempotent: true })
    }

    // ── Post-commit side effects (non-fatal) ───────────────────────────────

    let workflowResult = null
    try {
      if (nDate) workflowResult = generateWorkflowTasks(id)
    } catch (err) {
      console.error('[refillWorkflow] generation failed:', err.message)
    }

    try {
      createRefillNotifications(id)
    } catch (err) {
      console.error('[refillNotif] creation failed:', err.message)
    }

    audit(req, 'CREATE', id, {
      patientName: patientName.trim(),
      medicines: validMeds.length,
      token: db.prepare('SELECT token_id FROM refill_schedules WHERE id = ?').get(id)?.token_id,
    })

    const created = attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(id))
    return res.status(201).json({ ...created, _workflowTasks: workflowResult })

  } catch (err) {
    console.error('[refill POST] Failed:', err.message)
    return res.status(500).json({
      error: 'Failed to save refill schedule.',
      detail: err.message,
    })
  }
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

  try {
    const doUpdate = db.transaction(() => {
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

      if (Array.isArray(medicines)) {
        const validMeds = medicines.filter((m) => ((m.medicineName || m.medicine_name || '') + '').trim())
        db.prepare('DELETE FROM refill_medicines WHERE refill_schedule_id = ?').run(req.params.id)
        if (validMeds.length > 0) {
          const ins = db.prepare(`
            INSERT INTO refill_medicines
              (refill_schedule_id, medicine_name, strength, quantity_required,
               preferred_brand, substitute_allowed, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          for (const m of validMeds) {
            const name = ((m.medicineName || m.medicine_name) + '').trim()
            const qty = parseInt(m.quantityRequired ?? m.quantity_required ?? 1, 10) || 1
            const subOk = m.substituteAllowed ?? m.substitute_allowed ?? false
            ins.run(
              req.params.id, name, m.strength || null, qty,
              m.preferredBrand || m.preferred_brand || null, subOk ? 1 : 0, m.notes || null,
            )
          }
        }
      }
    })

    doUpdate()
    audit(req, 'EDIT', req.params.id, { patientName: patientName ?? row.patient_name })
    res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
  } catch (err) {
    console.error('[refill PUT] Failed:', err.message)
    res.status(500).json({ error: 'Failed to update refill schedule.', detail: err.message })
  }
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

  const token = row.token_id || `SCHED-${req.params.id}`
  const schedId = parseInt(req.params.id, 10)

  // ── Workflow-driven notifications ─────────────────────────────────────
  try {
    // Stock Not Available: assign purchase staff to reorder
    if (status === 'reorder_required' && row.assigned_purchase_staff_id) {
      emitNotif(
        `Order Required: ${row.patient_name}`,
        `Stock not available for refill ${token}. Please place order with supplier. Refill due: ${row.next_refill_date || 'TBD'}.`,
        'refill', 'high', schedId,
        `refill:reorder:${schedId}`,
        true, row.assigned_purchase_staff_id
      )
      audit(req, 'NOTIF_PURCHASE_ASSIGNED', schedId, { token, staffId: row.assigned_purchase_staff_id })
    }

    // Stock Available (after reorder): mark purchase notification done, alert sales
    if (status === 'stock_available') {
      // Mark purchase staff notifications complete
      if (row.assigned_purchase_staff_id) {
        db.prepare(`
          UPDATE notifications
          SET action_completed = 1
          WHERE related_schedule_id = ? AND target_staff_id = ? AND requires_action = 1 AND action_completed = 0
        `).run(schedId, row.assigned_purchase_staff_id)
      }
      // Re-notify sales staff that stock is ready
      if (row.assigned_sales_staff_id) {
        emitNotif(
          `Stock Available: ${row.patient_name}`,
          `Stock is now available for refill ${token}. Proceed with patient confirmation and dispatch.`,
          'refill', 'high', schedId,
          `refill:stock-avail:${schedId}:${Date.now()}`,
          true, row.assigned_sales_staff_id
        )
      }
      audit(req, 'NOTIF_STOCK_AVAILABLE', schedId, { token })
    }

    // Patient confirmed / dispatched / delivered / cancelled: resolve all required notifications
    if (['dispatched', 'delivered', 'cancelled'].includes(status)) {
      db.prepare(`
        UPDATE notifications
        SET action_completed = 1, is_read = 1
        WHERE related_schedule_id = ? AND requires_action = 1 AND action_completed = 0
      `).run(schedId)
      audit(req, 'NOTIF_RESOLVED', schedId, { status, token })
    }
  } catch (err) {
    console.error('[refill workflow-notif] error:', err.message)
  }

  // Advance linked workflow task status
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
  res.json({
    ...updated,
    medicines: db.prepare('SELECT * FROM refill_medicines WHERE refill_schedule_id = ?').all(req.params.id),
  })
})

// ── GET /api/refill-schedules/:id/workflow-transitions ───────────────────

router.get('/:id/workflow-transitions', (req, res) => {
  const row = db.prepare('SELECT workflow_status FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })
  res.json({ current: row.workflow_status, allowed: WORKFLOW_TRANSITIONS[row.workflow_status] ?? [] })
})

// ── POST /api/refill-schedules/:id/generate-workflow ─────────────────────

router.post('/:id/generate-workflow', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

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

// ── DELETE /api/refill-schedules/:id ─────────────────────────────────────

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Refill schedule not found.' })

  const hard = req.query.hard === 'true'

  if (hard) {
    db.prepare('DELETE FROM refill_schedules WHERE id = ?').run(req.params.id)
    audit(req, 'DELETE_HARD', req.params.id, { patientName: row.patient_name })
    return res.json({ message: 'Deleted permanently.' })
  }

  db.prepare(`UPDATE refill_schedules SET scheduler_status='cancelled', updated_at=datetime('now') WHERE id=?`)
    .run(req.params.id)

  // Resolve all outstanding required notifications for cancelled schedule
  try {
    db.prepare(`
      UPDATE notifications
      SET action_completed = 1, is_read = 1
      WHERE related_schedule_id = ? AND requires_action = 1 AND action_completed = 0
    `).run(req.params.id)
  } catch { /* non-fatal */ }

  audit(req, 'CANCEL', req.params.id, { patientName: row.patient_name })

  res.json(attachMedicines(db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(req.params.id)))
})

module.exports = router
