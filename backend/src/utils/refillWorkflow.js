'use strict'

const db = require('../database')

// Days before next_refill_date each workflow step is due
const STEP_OFFSETS = {
  stock_check:         -7,
  reorder_medicines:   -5,
  verify_availability: -3,
  patient_call:        -2,
  dispatch:             0,
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function staffName(staffId) {
  if (!staffId) return null
  const row = db.prepare('SELECT name FROM staff WHERE id = ?').get(staffId)
  return row ? row.name : null
}

function buildMedicineDescription(medicines, patientMobile, deliveryMode) {
  const lines = []
  if (patientMobile) lines.push(`Patient mobile: ${patientMobile}`)
  lines.push(`Delivery mode: ${deliveryMode || 'pickup'}`)
  if (medicines && medicines.length > 0) {
    lines.push('Medicines:')
    for (const m of medicines) {
      const strength = m.strength ? ` ${m.strength}` : ''
      const qty = m.quantity_required ?? 1
      lines.push(`  • ${m.medicine_name}${strength} x${qty}`)
    }
  }
  return lines.join('\n')
}

function workflowSteps(schedule, medicines) {
  const {
    id, patient_name, patient_mobile, delivery_mode,
    next_refill_date, priority,
    assigned_purchase_staff_id, assigned_purchase_manager_id, assigned_sales_staff_id,
  } = schedule

  const refillDate = next_refill_date
  if (!refillDate) return []

  const baseDesc = buildMedicineDescription(medicines, patient_mobile, delivery_mode)

  const purchaseStaff   = staffName(assigned_purchase_staff_id)
  const purchaseManager = staffName(assigned_purchase_manager_id)
  const salesStaff      = staffName(assigned_sales_staff_id)

  const dispatchNote = delivery_mode === 'Shiprocket'
    ? '\n⚠ Shiprocket Dispatch Required'
    : ''

  return [
    {
      step: 'stock_check',
      title: `Check stock for Patient: ${patient_name}`,
      description: baseDesc,
      assigned_to: purchaseStaff,
      category: 'Purchase',
    },
    {
      step: 'reorder_medicines',
      title: `Reorder medicines for Patient: ${patient_name} if stock unavailable`,
      description: baseDesc,
      assigned_to: purchaseManager || purchaseStaff,
      category: 'Purchase',
    },
    {
      step: 'verify_availability',
      title: `Verify medicine availability for Patient: ${patient_name}`,
      description: baseDesc,
      assigned_to: purchaseManager,
      category: 'Purchase',
    },
    {
      step: 'patient_call',
      title: `Call Patient ${patient_name} for refill confirmation`,
      description: baseDesc,
      assigned_to: salesStaff,
      category: 'Sales',
    },
    {
      step: 'dispatch',
      title: `Dispatch medicines to Patient ${patient_name}`,
      description: baseDesc + dispatchNote,
      assigned_to: salesStaff,
      category: 'Dispatch',
    },
  ].map((s) => ({
    ...s,
    due_date: addDays(refillDate, STEP_OFFSETS[s.step]),
    priority: priority || 'medium',
    status: 'pending',
    patient_schedule_id: id,
    generated_from: 'patient-refill-scheduler',
    refill_cycle_key: refillDate,
    workflow_step: s.step,
  }))
}

const insertTask = db.prepare(`
  INSERT INTO tasks
    (title, description, category, priority, status, assigned_to, due_date,
     patient_schedule_id, generated_from, refill_cycle_key, workflow_step)
  VALUES
    (@title, @description, @category, @priority, @status, @assigned_to, @due_date,
     @patient_schedule_id, @generated_from, @refill_cycle_key, @workflow_step)
`)

const checkDuplicate = db.prepare(`
  SELECT id FROM tasks
  WHERE patient_schedule_id = ?
    AND refill_cycle_key     = ?
    AND workflow_step        = ?
  LIMIT 1
`)

function audit(action, entityId, details) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details)
       VALUES (?, 'refill_schedule', ?, ?)`
    ).run(action, entityId, typeof details === 'string' ? details : JSON.stringify(details))
  } catch { /* non-fatal */ }
}

/**
 * Generate the 5 workflow tasks for a refill schedule.
 * Returns { created: number, skipped: number, taskIds: number[] }
 */
function generateWorkflowTasks(scheduleId) {
  const schedule = db.prepare('SELECT * FROM refill_schedules WHERE id = ?').get(scheduleId)
  if (!schedule) throw new Error(`Refill schedule ${scheduleId} not found`)

  const medicines = db.prepare('SELECT * FROM refill_medicines WHERE refill_schedule_id = ?').all(scheduleId)
  const steps = workflowSteps(schedule, medicines)

  let created = 0
  let skipped = 0
  const taskIds = []

  const run = db.transaction(() => {
    for (const step of steps) {
      const existing = checkDuplicate.get(step.patient_schedule_id, step.refill_cycle_key, step.workflow_step)
      if (existing) {
        skipped++
        taskIds.push(existing.id)
        continue
      }
      const info = insertTask.run(step)
      taskIds.push(info.lastInsertRowid)
      created++
    }
  })

  run()

  audit('WORKFLOW_GENERATED', scheduleId, {
    cycleKey: schedule.next_refill_date,
    created,
    skipped,
    taskIds,
  })

  return { created, skipped, taskIds }
}

module.exports = { generateWorkflowTasks }
