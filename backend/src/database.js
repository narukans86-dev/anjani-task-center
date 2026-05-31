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

  CREATE TABLE IF NOT EXISTS checklists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    type        TEXT DEFAULT 'opening',
    is_default  INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checklist_completions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    checklist_id   INTEGER,
    completed_by   INTEGER,
    completed_date TEXT,
    completed_at   TEXT DEFAULT (datetime('now')),
    notes          TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT NOT NULL,
    message          TEXT,
    type             TEXT DEFAULT 'task',
    priority         TEXT DEFAULT 'medium',
    is_read          INTEGER DEFAULT 0,
    related_task_id  INTEGER,
    related_staff_id INTEGER,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   INTEGER,
    user_name   TEXT,
    details     TEXT,
    timestamp   TEXT DEFAULT (datetime('now'))
  );
`)

// ── Migrations: add new columns if they don't exist ────────────────────────

const taskCols = db.prepare("PRAGMA table_info(tasks)").all().map((c) => c.name)
const addTaskCol = (col, def) => {
  if (!taskCols.includes(col)) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`).run()
  }
}
addTaskCol('is_recurring',       'INTEGER DEFAULT 0')
addTaskCol('recurrence_type',    "TEXT DEFAULT 'none'")
addTaskCol('recurrence_days',    'TEXT')
addTaskCol('recurrence_end_date','TEXT')
addTaskCol('parent_task_id',     'INTEGER')
addTaskCol('template_id',        'TEXT')

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

// ── Seed default checklists ────────────────────────────────────────────────

const checklistCount = db.prepare('SELECT COUNT(*) AS n FROM checklists').get().n

if (checklistCount === 0) {
  const insertCl = db.prepare(
    'INSERT INTO checklists (title, type, order_index) VALUES (?, ?, ?)'
  )

  const openingItems = [
    'Store opened on time',
    'Computer/POS started and working',
    'Internet connection verified',
    'Cash counter checked and recorded',
    'Refrigerator temperature checked',
    'Near-expiry/short products reviewed',
    'Pending online orders checked',
    'RGHS pending prescriptions checked',
    'Morning cleaning completed',
    'Staff attendance confirmed',
  ]

  const closingItems = [
    'Cash handover completed',
    'POS day closing done',
    'Pending customer orders noted',
    'Refrigerator/insulin stock checked',
    'Expiry/near-expiry issues noted',
    'Evening cleaning completed',
    'Important issues reported to manager',
    'All systems shut down properly',
    'Store locked and secured',
  ]

  const seedChecklists = db.transaction(() => {
    openingItems.forEach((title, i) => insertCl.run(title, 'opening', i + 1))
    closingItems.forEach((title, i) => insertCl.run(title, 'closing', i + 1))
  })

  seedChecklists()
  console.log('[DB] Seeded default opening and closing checklists.')
}

module.exports = db
