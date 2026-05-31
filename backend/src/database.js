'use strict'

const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, '..', 'data', 'anjani.db')

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    name                    TEXT NOT NULL,
    role                    TEXT,
    department              TEXT,
    color                   TEXT DEFAULT '#3b82f6',
    status                  TEXT DEFAULT 'active',
    mobile_number           TEXT,
    email                   TEXT,
    whatsapp_number         TEXT,
    notification_preference TEXT DEFAULT 'App',
    created_at              TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    category     TEXT,
    priority     TEXT DEFAULT 'medium',
    status       TEXT DEFAULT 'pending',
    assigned_to  TEXT,
    due_date     TEXT,
    due_time     TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    updated_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id   INTEGER,
    action    TEXT,
    note      TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  );
`)

// ── Migrations: add new columns if they don't exist ────────────────────────

const staffCols = db.prepare("PRAGMA table_info(staff)").all().map((c) => c.name)
const addIfMissing = (col, def) => {
  if (!staffCols.includes(col)) {
    db.prepare(`ALTER TABLE staff ADD COLUMN ${col} ${def}`).run()
  }
}
addIfMissing('mobile_number', 'TEXT')
addIfMissing('email', 'TEXT')
addIfMissing('whatsapp_number', 'TEXT')
addIfMissing('notification_preference', "TEXT DEFAULT 'App'")

// ── Seed ───────────────────────────────────────────────────────────────────

const staffCount = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n

if (staffCount === 0) {
  const insert = db.prepare(
    'INSERT INTO staff (name, role, department, color, status, mobile_number, email, notification_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )

  const seedStaff = [
    ['Virendra Singh Rathore', 'Pharmacist',    'Sales',            '#3b82f6', 'active', '9829100001', 'virendra@anjanimedical.in', 'App'],
    ['Sita Ram Prajapat',      'Dispenser',     'Stock Audit',      '#8b5cf6', 'active', '9829100002', 'sita@anjanimedical.in',     'WhatsApp'],
    ['Manoj Kumar Saini',      'Cashier',       'Billing',          '#f59e0b', 'active', '9829100003', 'manoj@anjanimedical.in',    'App'],
    ['Rakesh Kumar Meena',     'Delivery',      'Delivery',         '#ef4444', 'active', '9829100004', 'rakesh@anjanimedical.in',   'SMS'],
    ['Aditya Parashar',        'Store Manager', 'Admin',            '#10b981', 'active', '9829100005', 'aditya@anjanimedical.in',   'Email'],
    ['Vakil Gurjar',           'Support Staff', 'Customer Support', '#06b6d4', 'active', '9829100006', 'vakil@anjanimedical.in',    'App'],
  ]

  const seedAll = db.transaction((rows) => {
    for (const r of rows) insert.run(...r)
  })

  seedAll(seedStaff)
  console.log('[DB] Seeded 6 staff members.')
}

module.exports = db
