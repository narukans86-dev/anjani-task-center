'use strict'

const express = require('express')
const cors = require('cors')

// Initialize DB (creates file + tables + seeds on first run)
const db = require('./database')

const staffRoutes = require('./routes/staff')
const tasksRoutes = require('./routes/tasks')

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Anjani Staff Task Command Center',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})

app.use('/api/staff', staffRoutes)
app.use('/api/tasks', tasksRoutes)

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

app.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────────────────┐')
  console.log('│   Anjani Staff Task Command Center — Backend         │')
  console.log('├─────────────────────────────────────────────────────┤')
  console.log(`│   Running at : http://localhost:${PORT}                  │`)
  console.log(`│   Health     : http://localhost:${PORT}/api/health       │`)
  console.log(`│   Staff      : http://localhost:${PORT}/api/staff        │`)
  console.log(`│   Tasks      : http://localhost:${PORT}/api/tasks        │`)
  console.log('│   Mode       : Development (--watch enabled)         │')
  console.log('└─────────────────────────────────────────────────────┘\n')
})
