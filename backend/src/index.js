'use strict'

// Load .env from repo root (two levels up from backend/src/)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })

const express = require('express')
const cors = require('cors')

// Initialize DB (creates file + tables + seeds on first run)
const db = require('./database')

const { requireAuth, requireAdmin } = require('./middleware/auth')

const authRouter             = require('./routes/auth')
const usersRouter            = require('./routes/users')
const staffRoutes            = require('./routes/staff')
const tasksRoutes            = require('./routes/tasks')
const checklistsRouter       = require('./routes/checklists')
const notificationsRouter    = require('./routes/notifications')
const auditRouter            = require('./routes/audit')
const reportsRouter          = require('./routes/reports')
const refillSchedulesRouter  = require('./routes/refillSchedules')
const taskTemplatesRouter    = require('./routes/taskTemplates')
const dailyRoutinesRouter    = require('./routes/dailyRoutines')
const pushRouter             = require('./routes/push')

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Request logger (dev only) ──────────────────────────────────────────────

app.use((req, _res, next) => {
  const ts = new Date().toLocaleTimeString('en-IN')
  console.log(`  [${ts}] ${req.method} ${req.path}`)
  next()
})

// ── Routes ─────────────────────────────────────────────────────────────────

// Public routes — no auth required
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Anjani Staff Task Command Center',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})
app.use('/api/auth', authRouter)

// Protected routes — valid session token required for all
app.use('/api/users',            requireAuth, usersRouter)
app.use('/api/staff',            requireAuth, staffRoutes)
app.use('/api/tasks',            requireAuth, tasksRoutes)
app.use('/api/checklists',       requireAuth, checklistsRouter)
app.use('/api/notifications',    requireAuth, notificationsRouter)
app.use('/api/audit',            requireAuth, auditRouter)
app.use('/api/reports',          requireAuth, reportsRouter)
app.use('/api/refill-schedules', requireAuth, refillSchedulesRouter)
app.use('/api/task-templates',   requireAuth, taskTemplatesRouter)
app.use('/api/daily-routine',    requireAuth, dailyRoutinesRouter)
app.use('/api/push',             requireAuth, pushRouter)

// ── Notification settings (admin only) ────────────────────────────────────
app.get('/api/notification-settings', requireAuth, (_req, res) => {
  const settings = db.prepare('SELECT * FROM notification_settings WHERE id=1').get()
  res.json(settings || {})
})
app.put('/api/notification-settings', requireAuth, requireAdmin, (req, res) => {
  const {
    push_enabled, refill_morning_reminder_time, task_morning_reminder_time,
    evening_reminder_time, end_of_day_time, escalation_enabled,
    default_sales_staff_id, default_purchase_staff_id,
  } = req.body
  db.prepare(`
    UPDATE notification_settings SET
      push_enabled=?,
      refill_morning_reminder_time=?,
      task_morning_reminder_time=?,
      evening_reminder_time=?,
      end_of_day_time=?,
      escalation_enabled=?,
      default_sales_staff_id=?,
      default_purchase_staff_id=?,
      updated_at=datetime('now')
    WHERE id=1
  `).run(
    push_enabled ?? 1,
    refill_morning_reminder_time ?? '09:30',
    task_morning_reminder_time ?? '09:30',
    evening_reminder_time ?? '17:00',
    end_of_day_time ?? '20:30',
    escalation_enabled ?? 1,
    default_sales_staff_id || null,
    default_purchase_staff_id || null
  )
  res.json(db.prepare('SELECT * FROM notification_settings WHERE id=1').get())
})

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// ── Global error handler ───────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// ── Start ──────────────────────────────────────────────────────────────────

const { startScheduler } = require('./scheduler')

app.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────────────────┐')
  console.log('│   Anjani Staff Task Command Center — Backend         │')
  console.log('├─────────────────────────────────────────────────────┤')
  console.log(`│   Running at : http://localhost:${PORT}                  │`)
  console.log(`│   Health     : http://localhost:${PORT}/api/health       │`)
  console.log(`│   Staff      : http://localhost:${PORT}/api/staff        │`)
  console.log(`│   Tasks      : http://localhost:${PORT}/api/tasks        │`)
  console.log(`│   Checklists : http://localhost:${PORT}/api/checklists   │`)
  console.log(`│   Notifs     : http://localhost:${PORT}/api/notifications │`)
  console.log(`│   Audit      : http://localhost:${PORT}/api/audit        │`)
  console.log(`│   Reports    : http://localhost:${PORT}/api/reports/daily│`)
  console.log('│   Mode       : Development (--watch enabled)         │')
  console.log('│   Push      : /api/push/vapid-public-key             │')
  console.log('└─────────────────────────────────────────────────────┘\n')
  startScheduler()
})
