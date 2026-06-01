'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

const today = () => new Date().toISOString().slice(0, 10)

// GET /api/reports/staff-performance
router.get('/staff-performance', (_req, res) => {
  const date = today()
  // LEFT JOIN from staff so every active staff member appears even with 0 tasks.
  const rows = db.prepare(`
    SELECT
      s.id AS assigned_to,
      COUNT(t.id) AS assigned,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN t.due_date < ? AND t.status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed,
      CASE WHEN COUNT(t.id) > 0
        THEN ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / COUNT(t.id), 1)
        ELSE 0
      END AS completion_pct
    FROM staff s
    LEFT JOIN tasks t ON s.id = t.assigned_to
    WHERE s.status = 'active'
    GROUP BY s.id
    ORDER BY completion_pct DESC, s.name ASC
  `).all(date)
  res.json(rows)
})

// GET /api/reports/department
router.get('/department', (_req, res) => {
  const date = today()
  const rows = db.prepare(`
    SELECT
      category,
      COUNT(*) AS total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN due_date < ? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed
    FROM tasks
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY total DESC
  `).all(date)
  res.json(rows)
})

// GET /api/reports/daily — today's summary
router.get('/daily', (_req, res) => {
  const date = today()

  const tasks = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN due_date < ? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed
    FROM tasks WHERE due_date = ?
  `).get(date, date)

  const clStat = (type) => {
    const total = db.prepare(
      "SELECT COUNT(*) AS n FROM checklists WHERE active=1 AND type=?"
    ).get(type).n
    const completed = db.prepare(`
      SELECT COUNT(DISTINCT c.id) AS n
      FROM checklists c
      JOIN checklist_completions cc ON cc.checklist_id=c.id AND cc.completed_date=?
      WHERE c.active=1 AND c.type=?
    `).get(date, type).n
    return { total, completed }
  }

  res.json({
    date,
    tasks,
    checklist: {
      opening: clStat('opening'),
      closing: clStat('closing'),
    },
  })
})

// GET /api/reports/priority
router.get('/priority', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      priority,
      COUNT(*) AS total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress
    FROM tasks
    GROUP BY priority
    ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
  `).all()
  res.json(rows)
})

// ── Refill Dashboard Summary ──────────────────────────────────────────────
// GET /api/reports/refill-summary
router.get('/refill-summary', (_req, res) => {
  const todayStr = today()
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const total        = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE scheduler_status='active'").get().n
  const dueNext7     = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE scheduler_status='active' AND next_refill_date BETWEEN ? AND ?").get(todayStr, in7).n
  const stockCheck   = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE workflow_status='stock_check_pending'").get().n
  const reorderReq   = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE workflow_status IN ('reorder_required','reorder_placed')").get().n
  const callPending  = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE workflow_status='patient_call_pending'").get().n
  const dispPending  = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE workflow_status='dispatch_pending'").get().n
  const shiprocket   = db.prepare("SELECT COUNT(*) AS n FROM refill_schedules WHERE workflow_status='dispatch_pending' AND delivery_mode='courier'").get().n

  // Weekend refill alerts — next_refill_date falls on Sat/Sun within 14 days
  const weekendRows  = db.prepare(`
    SELECT COUNT(*) AS n FROM refill_schedules
    WHERE scheduler_status='active'
      AND next_refill_date BETWEEN ? AND ?
      AND strftime('%w', next_refill_date) IN ('0','6')
  `).get(todayStr, new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)).n

  res.json({
    total,
    dueNext7,
    stockCheck,
    reorderRequired: reorderReq,
    callPending,
    dispatchPending: dispPending,
    weekendAlerts: weekendRows,
    shiprocketPending: shiprocket,
  })
})

// ── Refill Reports ────────────────────────────────────────────────────────

// GET /api/reports/refill-upcoming?days=7&priority=&patientType=
router.get('/refill-upcoming', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days ?? 7, 10)))
  const todayStr = today()
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const { priority, patientType, search } = req.query

  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name, s2.name AS purchase_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    LEFT JOIN staff s2 ON rs.assigned_purchase_staff_id = s2.id
    WHERE rs.scheduler_status = 'active'
      AND rs.next_refill_date BETWEEN ? AND ?
  `
  const params = [todayStr, until]
  if (priority)    { sql += ' AND rs.priority = ?';      params.push(priority) }
  if (patientType) { sql += ' AND rs.patient_type = ?';  params.push(patientType) }
  if (search)      { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-missed?days=30
router.get('/refill-missed', (req, res) => {
  const days = Math.min(180, Math.max(1, parseInt(req.query.days ?? 30, 10)))
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const todayStr = today()
  const { priority, patientType, search } = req.query

  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.scheduler_status = 'active'
      AND rs.next_refill_date < ?
      AND rs.workflow_status NOT IN ('delivered','cancelled')
  `
  const params = [todayStr]
  if (priority)    { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (patientType) { sql += ' AND rs.patient_type = ?';   params.push(patientType) }
  if (search)      { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-reorder?search=
router.get('/refill-reorder', (req, res) => {
  const { search, priority } = req.query
  let sql = `
    SELECT rs.*, s2.name AS purchase_staff_name, s3.name AS purchase_manager_name
    FROM refill_schedules rs
    LEFT JOIN staff s2 ON rs.assigned_purchase_staff_id = s2.id
    LEFT JOIN staff s3 ON rs.assigned_purchase_manager_id = s3.id
    WHERE rs.workflow_status IN ('reorder_required','reorder_placed')
  `
  const params = []
  if (priority) { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (search)   { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-call-pending?search=
router.get('/refill-call-pending', (req, res) => {
  const { search, priority, patientType } = req.query
  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.workflow_status = 'patient_call_pending'
  `
  const params = []
  if (priority)    { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (patientType) { sql += ' AND rs.patient_type = ?';   params.push(patientType) }
  if (search)      { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-dispatch-pending?deliveryMode=
router.get('/refill-dispatch-pending', (req, res) => {
  const { search, deliveryMode, priority } = req.query
  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.workflow_status = 'dispatch_pending'
  `
  const params = []
  if (deliveryMode) { sql += ' AND rs.delivery_mode = ?';    params.push(deliveryMode) }
  if (priority)     { sql += ' AND rs.priority = ?';         params.push(priority) }
  if (search)       { sql += ' AND rs.patient_name LIKE ?';  params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-staff-performance
router.get('/refill-staff-performance', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      s.name AS staff_name,
      s.department,
      COUNT(DISTINCT rs.id)          AS total_assigned,
      SUM(CASE WHEN rs.workflow_status = 'delivered'  THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN rs.workflow_status = 'dispatched' THEN 1 ELSE 0 END) AS dispatched,
      SUM(CASE WHEN rs.workflow_status IN ('dispatch_pending','patient_confirmed') THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN rs.workflow_status = 'cancelled'  THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN rs.workflow_status NOT IN ('delivered','cancelled')
                AND rs.next_refill_date < date('now') THEN 1 ELSE 0 END) AS overdue
    FROM staff s
    LEFT JOIN refill_schedules rs ON s.id = rs.assigned_sales_staff_id
    WHERE s.status = 'active'
    GROUP BY s.id, s.name, s.department
    ORDER BY delivered DESC
  `).all()
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-shiprocket
router.get('/refill-shiprocket', (req, res) => {
  const { search, priority } = req.query
  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.workflow_status = 'dispatch_pending'
      AND rs.delivery_mode = 'courier'
  `
  const params = []
  if (priority) { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (search)   { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

module.exports = router
