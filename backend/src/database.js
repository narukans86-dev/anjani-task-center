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
addIfMissing('timing', 'TEXT')
addIfMissing('main_responsibility', 'TEXT')

const PRODUCTIVITY_PLAN_STAFF = [
  {
    id: 1,
    name: 'Virendra Singh',
    role: 'Opening + Counter Control',
    department: 'Sales',
    color: '#3b82f6',
    status: 'active',
    mobile_number: '9829100001',
    email: 'virendra@anjanimedical.in',
    whatsapp_number: null,
    notification_preference: 'App',
    timing: '8:00 AM - 6:30 PM',
    main_responsibility: 'Opening setup, counter sales, shortage noting, rack discipline.',
  },
  {
    id: 2,
    name: 'Naveen',
    role: 'Opening + Customer Support',
    department: 'Customer Support',
    color: '#8b5cf6',
    status: 'active',
    mobile_number: '9829100002',
    email: 'naveen@anjanimedical.in',
    whatsapp_number: null,
    notification_preference: 'WhatsApp',
    timing: '8:00 AM - 6:30 PM',
    main_responsibility: 'Pending orders, customer follow-up, refill calls, delivery follow-up.',
  },
  {
    id: 3,
    name: 'Raj Laxkar',
    role: 'Daily Accounts / Accountant',
    department: 'Accounts',
    color: '#f59e0b',
    status: 'active',
    mobile_number: '9829100003',
    email: 'raj@anjanimedical.in',
    whatsapp_number: null,
    notification_preference: 'App',
    timing: 'Split duty around 2:00 PM and 9:45 PM daily',
    main_responsibility: '2 PM cash handover, wholesaler management, 9:45 PM closing, cash verification and overtime verification.',
  },
  {
    id: 4,
    name: 'Rakesh Kumar Meena',
    role: 'Sales Manager',
    department: 'Sales',
    color: '#ef4444',
    status: 'active',
    mobile_number: '9829100004',
    email: 'rakesh@anjanimedical.in',
    whatsapp_number: null,
    notification_preference: 'SMS',
    timing: '10:00 AM - 8:30 PM',
    main_responsibility: 'Sales floor control, average bill value, staff discipline, daily sales report.',
  },
  {
    id: 5,
    name: 'Aditya Parashar',
    role: 'Evening Counter + Closing Support',
    department: 'Sales',
    color: '#10b981',
    status: 'active',
    mobile_number: '9829100005',
    email: 'aditya@anjanimedical.in',
    whatsapp_number: null,
    notification_preference: 'Email',
    timing: '12:00 PM - 10:30 PM',
    main_responsibility: 'Evening counter sales, pending order follow-up, closing support.',
  },
  {
    id: 6,
    name: 'Vakil Gurjar',
    role: 'Purchase Manager',
    department: 'Purchase',
    color: '#06b6d4',
    status: 'active',
    mobile_number: '9829100006',
    email: 'vakil@anjanimedical.in',
    whatsapp_number: null,
    notification_preference: 'App',
    timing: '12:00 PM - 10:30 PM',
    main_responsibility: 'Purchase order, shortage prevention, supplier rate comparison, expiry replacement claims.',
  },
]

// ── Seed ───────────────────────────────────────────────────────────────────

const staffCount = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n

if (staffCount === 0) {
  const insert = db.prepare(
    `INSERT INTO staff (
      id, name, role, department, color, status, mobile_number, email,
      whatsapp_number, notification_preference, timing, main_responsibility
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const seedAll = db.transaction((rows) => {
    for (const s of rows) {
      insert.run(
        s.id,
        s.name,
        s.role,
        s.department,
        s.color,
        s.status,
        s.mobile_number,
        s.email,
        s.whatsapp_number,
        s.notification_preference,
        s.timing,
        s.main_responsibility
      )
    }
  })

  seedAll(PRODUCTIVITY_PLAN_STAFF)
  console.log('[DB] Seeded 6 staff members.')
}

// Keep local demo staff aligned with the productivity plan while preserving task assignments by staff id.
const syncStaff = db.transaction((rows) => {
  const update = db.prepare(`
    UPDATE staff SET
      name=@name,
      role=@role,
      department=@department,
      color=@color,
      status=@status,
      mobile_number=@mobile_number,
      email=@email,
      whatsapp_number=@whatsapp_number,
      notification_preference=@notification_preference,
      timing=@timing,
      main_responsibility=@main_responsibility
    WHERE id=@id
  `)
  const insert = db.prepare(`
    INSERT INTO staff (
      id, name, role, department, color, status, mobile_number, email,
      whatsapp_number, notification_preference, timing, main_responsibility
    ) VALUES (
      @id, @name, @role, @department, @color, @status, @mobile_number, @email,
      @whatsapp_number, @notification_preference, @timing, @main_responsibility
    )
  `)

  for (const s of rows) {
    const info = update.run(s)
    if (info.changes === 0) insert.run(s)
  }

  db.prepare(`
    UPDATE staff
    SET status='inactive'
    WHERE id NOT IN (${rows.map(() => '?').join(',')})
  `).run(...rows.map((s) => s.id))
})

syncStaff(PRODUCTIVITY_PLAN_STAFF)

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
