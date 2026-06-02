'use strict'

const express = require('express')
const db = require('../database')

const router = express.Router()

const today = () => new Date().toISOString().slice(0, 10)

// ── Middleware: Role Checks ────────────────────────────────────────────────

function adminOnly(req, res, next) {
  if (req.currentUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required for this report.' })
  }
  next()
}

/**
 * Filter SQL by staff_id if user is standard staff.
 * Admins and Managers (like Rakesh sales_manager) see all by default.
 */
function getStaffFilter(user) {
  const isStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isStaff && user.staff_id) {
    return {
      clause: ' AND (rs.assigned_sales_staff_id = ? OR rs.assigned_purchase_staff_id = ?)',
      params: [user.staff_id, user.staff_id],
    }
  }
  return { clause: '', params: [] }
}

// ── Standard Reports (Admin Only) ──────────────────────────────────────────

// GET /api/reports/staff-performance
router.get('/staff-performance', adminOnly, (_req, res) => {
  const date = today()
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
router.get('/department', adminOnly, (_req, res) => {
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
router.get('/daily', adminOnly, (_req, res) => {
  const date = today()

  const tasks = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN due_date < ? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS delayed
    FROM tasks WHERE due_date = ?
  `).get(date, date) || { total: 0, completed: 0, pending: 0, delayed: 0 }

  const clStat = (type) => {
    const totalRow = db.prepare(
      "SELECT COUNT(*) AS n FROM checklists WHERE active=1 AND type=?"
    ).get(type)
    const total = totalRow ? totalRow.n : 0

    const completedRow = db.prepare(`
      SELECT COUNT(DISTINCT c.id) AS n
      FROM checklists c
      JOIN checklist_completions cc ON cc.checklist_id=c.id AND cc.completed_date=?
      WHERE c.active=1 AND c.type=?
    `).get(date, type)
    const completed = completedRow ? completedRow.n : 0
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
router.get('/priority', adminOnly, (_req, res) => {
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

// ── Refill Dashboard Summary (Auth Required) ──────────────────────────────

// GET /api/reports/refill-summary
router.get('/refill-summary', (req, res) => {
  const user = req.currentUser
  const todayStr = today()
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // Use alias rs to match getStaffFilter
  let where = "WHERE rs.scheduler_status='active'"
  let p = []
  
  const filter = getStaffFilter(user)
  if (filter.clause) {
    where += filter.clause
    p.push(...filter.params)
  }

  const getCount = (sql, params = []) => {
    const row = db.prepare(sql).get(...params)
    return row ? row.n : 0
  }

  const total        = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${where}`, p)
  const dueNext7     = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${where} AND rs.next_refill_date BETWEEN ? AND ?`, [...p, todayStr, in7])
  
  // Re-base filter for specific statuses
  const baseWhere = filter.clause ? `WHERE 1=1 ${filter.clause}` : ''
  const baseParams = filter.params

  const stockCheck   = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${baseWhere || 'WHERE 1=1'} AND rs.workflow_status='stock_check_pending'`, baseParams)
  const reorderReq   = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${baseWhere || 'WHERE 1=1'} AND rs.workflow_status IN ('reorder_required','reorder_placed')`, baseParams)
  const callPending  = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${baseWhere || 'WHERE 1=1'} AND rs.workflow_status='patient_call_pending'`, baseParams)
  const dispPending  = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${baseWhere || 'WHERE 1=1'} AND rs.workflow_status='dispatch_pending'`, baseParams)
  const shiprocket   = getCount(`SELECT COUNT(*) AS n FROM refill_schedules rs ${baseWhere || 'WHERE 1=1'} AND rs.workflow_status='dispatch_pending' AND rs.delivery_mode='courier'`, baseParams)

  // Weekend refill alerts — next_refill_date falls on Sat/Sun within 14 days
  const weekendAlerts = getCount(`
    SELECT COUNT(*) AS n FROM refill_schedules rs
    ${where}
      AND rs.next_refill_date BETWEEN ? AND ?
      AND strftime('%w', rs.next_refill_date) IN ('0','6')
  `, [...p, todayStr, in14])

  res.json({
    total,
    dueNext7,
    stockCheck,
    reorderRequired: reorderReq,
    callPending,
    dispatchPending: dispPending,
    weekendAlerts,
    shiprocketPending: shiprocket,
  })
})

// ── Refill Reports (Auth Required) ─────────────────────────────────────────

// GET /api/reports/refill-upcoming?days=7&priority=&patientType=
router.get('/refill-upcoming', (req, res) => {
  const user = req.currentUser
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

  const filter = getStaffFilter(user)
  if (filter.clause) {
    sql += filter.clause
    params.push(...filter.params)
  }

  if (priority)    { sql += ' AND rs.priority = ?';      params.push(priority) }
  if (patientType) { sql += ' AND rs.patient_type = ?';  params.push(patientType) }
  if (search)      { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-missed?days=30
router.get('/refill-missed', (req, res) => {
  const user = req.currentUser
  const days = Math.min(180, Math.max(1, parseInt(req.query.days ?? 30, 10)))
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

  const filter = getStaffFilter(user)
  if (filter.clause) {
    sql += filter.clause
    params.push(...filter.params)
  }

  if (priority)    { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (patientType) { sql += ' AND rs.patient_type = ?';   params.push(patientType) }
  if (search)      { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-reorder?search=
router.get('/refill-reorder', (req, res) => {
  const user = req.currentUser
  const { search, priority } = req.query
  let sql = `
    SELECT rs.*, s2.name AS purchase_staff_name, s3.name AS purchase_manager_name
    FROM refill_schedules rs
    LEFT JOIN staff s2 ON rs.assigned_purchase_staff_id = s2.id
    LEFT JOIN staff s3 ON rs.assigned_purchase_manager_id = s3.id
    WHERE rs.workflow_status IN ('reorder_required','reorder_placed')
  `
  const params = []

  const filter = getStaffFilter(user)
  if (filter.clause) {
    sql += filter.clause
    params.push(...filter.params)
  }

  if (priority) { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (search)   { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-call-pending?search=
router.get('/refill-call-pending', (req, res) => {
  const user = req.currentUser
  const { search, priority, patientType } = req.query
  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.workflow_status = 'patient_call_pending'
  `
  const params = []

  const filter = getStaffFilter(user)
  if (filter.clause) {
    sql += filter.clause
    params.push(...filter.params)
  }

  if (priority)    { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (patientType) { sql += ' AND rs.patient_type = ?';   params.push(patientType) }
  if (search)      { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-dispatch-pending?deliveryMode=
router.get('/refill-dispatch-pending', (req, res) => {
  const user = req.currentUser
  const { search, deliveryMode, priority } = req.query
  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.workflow_status = 'dispatch_pending'
  `
  const params = []

  const filter = getStaffFilter(user)
  if (filter.clause) {
    sql += filter.clause
    params.push(...filter.params)
  }

  if (deliveryMode) { sql += ' AND rs.delivery_mode = ?';    params.push(deliveryMode) }
  if (priority)     { sql += ' AND rs.priority = ?';         params.push(priority) }
  if (search)       { sql += ' AND rs.patient_name LIKE ?';  params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-staff-performance
router.get('/refill-staff-performance', (req, res) => {
  const user = req.currentUser
  let sql = `
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
  `
  const params = []

  // If standard staff, they only see their own performance line
  const isStaff = user.role === 'staff' && user.access_role !== 'sales_manager'
  if (isStaff && user.staff_id) {
    sql += ' AND s.id = ?'
    params.push(user.staff_id)
  }

  sql += `
    GROUP BY s.id, s.name, s.department
    ORDER BY delivered DESC
  `

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

// GET /api/reports/refill-shiprocket
router.get('/refill-shiprocket', (req, res) => {
  const user = req.currentUser
  const { search, priority } = req.query
  let sql = `
    SELECT rs.*, s1.name AS sales_staff_name
    FROM refill_schedules rs
    LEFT JOIN staff s1 ON rs.assigned_sales_staff_id = s1.id
    WHERE rs.workflow_status = 'dispatch_pending'
      AND rs.delivery_mode = 'courier'
  `
  const params = []

  const filter = getStaffFilter(user)
  if (filter.clause) {
    sql += filter.clause
    params.push(...filter.params)
  }

  if (priority) { sql += ' AND rs.priority = ?';       params.push(priority) }
  if (search)   { sql += ' AND rs.patient_name LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY rs.priority DESC, rs.next_refill_date ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ total: rows.length, data: rows })
})

module.exports = router
