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
    description TEXT,
    type        TEXT DEFAULT 'opening',
    is_default  INTEGER DEFAULT 1,
    is_required INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_templates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    category     TEXT,
    priority     TEXT DEFAULT 'medium',
    department   TEXT,
    assigned_to  INTEGER,
    active       INTEGER DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
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

  CREATE TABLE IF NOT EXISTS daily_routine_templates (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id          INTEGER,
    staff_role        TEXT,
    department        TEXT,
    title             TEXT NOT NULL,
    description       TEXT,
    routine_type      TEXT DEFAULT 'Full Day',
    priority          TEXT DEFAULT 'medium',
    expected_time     TEXT,
    estimated_minutes INTEGER,
    is_required       INTEGER DEFAULT 1,
    active            INTEGER DEFAULT 1,
    display_order     INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS refill_schedules (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name                TEXT NOT NULL,
    patient_mobile              TEXT,
    patient_whatsapp            TEXT,
    patient_email               TEXT,
    patient_address             TEXT,
    patient_type                TEXT DEFAULT 'regular',
    refill_date                 TEXT,
    refill_frequency            TEXT DEFAULT 'monthly',
    custom_interval_days        INTEGER,
    assigned_sales_staff_id     INTEGER,
    assigned_purchase_staff_id  INTEGER,
    assigned_purchase_manager_id INTEGER,
    delivery_mode               TEXT DEFAULT 'pickup',
    scheduler_status            TEXT DEFAULT 'active',
    workflow_status             TEXT DEFAULT 'pending',
    priority                    TEXT DEFAULT 'medium',
    start_reminder_days_before  INTEGER DEFAULT 3,
    notes                       TEXT,
    last_processed_date         TEXT,
    next_refill_date            TEXT,
    created_at                  TEXT DEFAULT (datetime('now')),
    updated_at                  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refill_medicines (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    refill_schedule_id  INTEGER NOT NULL REFERENCES refill_schedules(id) ON DELETE CASCADE,
    medicine_name       TEXT NOT NULL,
    strength            TEXT,
    quantity_required   INTEGER DEFAULT 1,
    preferred_brand     TEXT,
    substitute_allowed  INTEGER DEFAULT 0,
    notes               TEXT
  );
`)

// ── Migrations: add new columns if they don't exist ────────────────────────

const checklistCols = db.prepare("PRAGMA table_info(checklists)").all().map((c) => c.name)
if (!checklistCols.includes('description')) {
  db.prepare('ALTER TABLE checklists ADD COLUMN description TEXT').run()
}
if (!checklistCols.includes('is_required')) {
  db.prepare('ALTER TABLE checklists ADD COLUMN is_required INTEGER DEFAULT 1').run()
}

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
// refill workflow linkage
addTaskCol('patient_schedule_id','INTEGER')
addTaskCol('generated_from',     'TEXT')
addTaskCol('refill_cycle_key',   'TEXT')
addTaskCol('workflow_step',      'TEXT')

// task_templates seed
const templateCount = db.prepare('SELECT COUNT(*) AS n FROM task_templates').get().n
if (templateCount === 0) {
  const TASK_TEMPLATES_SEED = [
    { title: 'Check high-demand product display', category: 'Sales', priority: 'medium', description: 'Verify all high-demand products are properly displayed and stocked at counter.' },
    { title: 'Follow up pending customer orders', category: 'Sales', priority: 'high', description: 'Call customers with pending/ready orders for pickup.' },
    { title: 'Review near-short products', category: 'Purchase', priority: 'high', description: 'Identify products below minimum stock level and add to purchase list.' },
    { title: 'Prepare supplier purchase list', category: 'Purchase', priority: 'medium', description: "Compile final purchase order list for today's supplier call." },
    { title: 'Audit selected rack/shelf', category: 'Stock Audit', priority: 'medium', description: 'Physical count of assigned rack. Report mismatches.' },
    { title: 'Check pending RGHS prescriptions', category: 'RGHS', priority: 'critical', description: 'Review all pending RGHS prescriptions for OPD date, seal, and doctor signature.' },
    { title: 'Track unpaid RGHS bills', category: 'RGHS', priority: 'high', description: 'Check status of submitted RGHS bills and follow up on unpaid claims.' },
    { title: 'Pack and dispatch online orders', category: 'Delivery', priority: 'high', description: 'Pack all confirmed online orders and hand over to delivery partner.' },
    { title: 'Check near-expiry stock', category: 'Expiry Return', priority: 'critical', description: 'Identify products expiring within 60 days and flag for return.' },
    { title: 'Prepare supplier return list', category: 'Expiry Return', priority: 'high', description: 'Compile expiry return items with batch/quantity for supplier.' },
    { title: 'Daily cash handover', category: 'Admin', priority: 'critical', description: 'Count, verify, and hand over daily cash to manager with slip.' },
    { title: 'Daily issue report to manager', category: 'Admin', priority: 'medium', description: "Submit summary of today's issues, complaints, and pending items." },
    { title: 'Refrigerator temperature check', category: 'Cleaning / Store Maintenance', priority: 'high', description: 'Record fridge temperature. Escalate if outside normal range.' },
    { title: 'Morning store cleaning verification', category: 'Cleaning / Store Maintenance', priority: 'medium', description: 'Confirm all areas cleaned before store opens.' },
  ]

  const insertTpl = db.prepare(
    'INSERT INTO task_templates (title, category, priority, description) VALUES (?, ?, ?, ?)'
  )
  const seedTemplates = db.transaction(() => {
    TASK_TEMPLATES_SEED.forEach((t) => insertTpl.run(t.title, t.category, t.priority, t.description))
  })
  seedTemplates()
  console.log('[DB] Seeded 14 task templates.')
}

// notifications dedup key
const notifCols = db.prepare("PRAGMA table_info(notifications)").all().map((c) => c.name)
if (!notifCols.includes('dedup_key')) {
  db.prepare('ALTER TABLE notifications ADD COLUMN dedup_key TEXT').run()
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(dedup_key) WHERE dedup_key IS NOT NULL').run()
}
// notifications refill schedule link
if (!notifCols.includes('related_schedule_id')) {
  db.prepare('ALTER TABLE notifications ADD COLUMN related_schedule_id INTEGER').run()
}

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

// ── Seed default daily routine templates ───────────────────────────────────

const routineTemplateCount = db.prepare('SELECT COUNT(*) AS n FROM daily_routine_templates').get().n

if (routineTemplateCount === 0) {
  const insertRt = db.prepare(`
    INSERT INTO daily_routine_templates 
    (staff_id, staff_role, title, routine_type, display_order) 
    VALUES (?, ?, ?, ?, ?)
  `)

  const ROUTINE_SEED = [
    { staff_id: 1, role: 'Opening + Counter Control', items: ['Opening setup completed before 9 AM', 'POS/printer/rack readiness checked', 'Shortage items noted during opening/low time', 'Rack discipline maintained', 'Counter delay avoided during rush', 'Near-stock-out items communicated to purchase', 'Opening area cleanliness checked'] },
    { staff_id: 2, role: 'Opening + Customer Support', items: ['Pending orders checked', 'Minimum 20 customer follow-ups/messages/calls completed', 'Refill calls to regular chronic patients completed', 'Delivery follow-up updated', 'Customer pending status updated', 'Lost sales/customer demand noted', 'Low-time customer callback list completed'] },
    { staff_id: 4, role: 'Sales Manager', items: ['Daily sales report prepared', 'Staff discipline checked', '10-15 high-value/repeat customer follow-ups completed', 'Lost sales reviewed', 'Floor supervision done during rush', 'RGHS bill/document checking reviewed', 'Average bill value improvement checked'] },
    { staff_id: 5, role: 'Evening Counter + Closing Support', items: ['Evening pending orders followed', 'Late customer requirements recorded', 'Closing support completed', 'Next-day pending needs noted', 'Evening counter handled without delay', 'Rack/product arrangement checked before closing', 'Customer requirements after 8 PM noted'] },
    { staff_id: 6, role: 'Purchase Manager', items: ['Purchase order prepared', 'Supplier rate comparison done before PO', 'Zero-stock prevention checked', 'Expiry replacement/claims tracked', 'Shortage list reviewed', 'Near-stock-out list checked', 'Supplier follow-up completed'] },
    { staff_id: 3, role: 'Daily Accounts / Accountant', items: ['2 PM cash handover completed', 'Wholesaler updates completed', '9:45 PM final cash verification completed', 'Overtime verification completed', 'Account/cash mismatch noted if any', 'Pending bills/accounts reviewed', 'Closing account status updated'] },
  ]

  const FREE_TIME_SEED = [
    'Pending customer order follow-up',
    'Refill calls to regular chronic patients',
    'Shortage and near-stock-out list',
    'Purchase rate comparison before PO',
    'Expiry and near-expiry checking',
    'Random stock audit - 20 items/day',
    'RGHS bill/document checking',
    'Rack cleaning and product arrangement',
  ]

  const seedRoutine = db.transaction(() => {
    ROUTINE_SEED.forEach(staff => {
      staff.items.forEach((title, i) => {
        insertRt.run(staff.staff_id, staff.role, title, 'Full Day', i + 1)
      })
    })
    FREE_TIME_SEED.forEach((title, i) => {
      insertRt.run(null, null, title, 'Free Time', i + 1)
    })
  })

  seedRoutine()
  console.log('[DB] Seeded default daily routine templates.')
}

module.exports = db
