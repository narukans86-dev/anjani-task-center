const SETTINGS_KEY = 'anjani_settings'

export const DEFAULT_SETTINGS = {
  companyName: 'Anjani Medical',
  branchName: 'Main Branch',
  workingHoursStart: '09:00',
  workingHoursEnd: '21:00',
  defaultCategories: [
    'Sales', 'Purchase', 'Stock Audit', 'RGHS', 'Customer Support',
    'Delivery', 'Billing', 'Expiry Return', 'Admin', 'Cleaning', 'Accounts',
  ],
  defaultDepartments: ['Sales', 'Purchase', 'Customer Support', 'Accounts', 'Admin'],
  theme: 'dark',
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function getAllTasks() {
  const result = await apiFetch('/tasks')
  return Array.isArray(result) ? result : (result.data ?? [])
}

export async function saveTasks(tasks) {
  // Bulk-create tasks after clearing (used by importData / resetToSampleData)
  await Promise.allSettled(
    tasks.map((t) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(t) }))
  )
}

export async function getAllStaff() {
  const result = await apiFetch('/staff')
  return Array.isArray(result) ? result : (result.data ?? [])
}

export async function saveStaff(staff) {
  await Promise.allSettled(
    staff.map((s) => apiFetch('/staff', { method: 'POST', body: JSON.stringify(s) }))
  )
}

// ── Backup ─────────────────────────────────────────────────────────────────────

export async function exportAllData() {
  const [tasks, staff] = await Promise.all([
    getAllTasks().catch(() => []),
    getAllStaff().catch(() => []),
  ])
  const data = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    staff,
    tasks,
  }
  const json = JSON.stringify(data, null, 2)

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `anjani-backup-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  localStorage.setItem('anjani_last_export', new Date().toISOString())
  return json
}

export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid JSON format.' }
    }
    if (!data.version || !data.exportedAt) {
      return { success: false, message: 'File does not look like an Anjani backup.' }
    }

    if (data.settings) {
      saveSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    }

    if (Array.isArray(data.tasks) && data.tasks.length) {
      const existing = await getAllTasks().catch(() => [])
      await Promise.allSettled(existing.map((t) => apiFetch(`/tasks/${t.id}`, { method: 'DELETE' })))
      await saveTasks(data.tasks.map(({ id: _id, created_at: _c, ...rest }) => rest))
    }

    if (Array.isArray(data.staff) && data.staff.length) {
      const existing = await getAllStaff().catch(() => [])
      await Promise.allSettled(existing.map((s) => apiFetch(`/staff/${s.id}`, { method: 'DELETE' })))
      await saveStaff(data.staff.map(({ id: _id, created_at: _c, ...rest }) => rest))
    }

    return { success: true, message: `Imported ${data.tasks?.length ?? 0} tasks and ${data.staff?.length ?? 0} staff members.` }
  } catch (e) {
    return { success: false, message: `Import failed: ${e.message}` }
  }
}

export async function clearAllData() {
  const [tasks, staff] = await Promise.all([
    getAllTasks().catch(() => []),
    getAllStaff().catch(() => []),
  ])
  await Promise.allSettled([
    ...tasks.map((t) => apiFetch(`/tasks/${t.id}`, { method: 'DELETE' })),
    ...staff.map((s) => apiFetch(`/staff/${s.id}`, { method: 'DELETE' })),
  ])
}

const SAMPLE_STAFF = [
  {
    name: 'Virendra Singh',
    role: 'Opening + Counter Control',
    department: 'Sales',
    color: '#3b82f6',
    status: 'active',
    mobile_number: '9829100001',
    email: 'virendra@anjanimedical.in',
    notification_preference: 'App',
    timing: '8:00 AM - 6:30 PM',
    main_responsibility: 'Opening setup, counter sales, shortage noting, rack discipline.',
  },
  {
    name: 'Naveen',
    role: 'Opening + Customer Support',
    department: 'Customer Support',
    color: '#8b5cf6',
    status: 'active',
    mobile_number: '9829100002',
    email: 'naveen@anjanimedical.in',
    notification_preference: 'WhatsApp',
    timing: '8:00 AM - 6:30 PM',
    main_responsibility: 'Pending orders, customer follow-up, refill calls, delivery follow-up.',
  },
  {
    name: 'Rakesh Kumar Meena',
    role: 'Sales Manager',
    department: 'Sales',
    color: '#ef4444',
    status: 'active',
    mobile_number: '9829100004',
    email: 'rakesh@anjanimedical.in',
    notification_preference: 'SMS',
    timing: '10:00 AM - 8:30 PM',
    main_responsibility: 'Sales floor control, average bill value, staff discipline, daily sales report.',
  },
  {
    name: 'Aditya Parashar',
    role: 'Evening Counter + Closing Support',
    department: 'Sales',
    color: '#10b981',
    status: 'active',
    mobile_number: '9829100005',
    email: 'aditya@anjanimedical.in',
    notification_preference: 'Email',
    timing: '12:00 PM - 10:30 PM',
    main_responsibility: 'Evening counter sales, pending order follow-up, closing support.',
  },
  {
    name: 'Vakil Gurjar',
    role: 'Purchase Manager',
    department: 'Purchase',
    color: '#06b6d4',
    status: 'active',
    mobile_number: '9829100006',
    email: 'vakil@anjanimedical.in',
    notification_preference: 'App',
    timing: '12:00 PM - 10:30 PM',
    main_responsibility: 'Purchase order, shortage prevention, supplier rate comparison, expiry replacement claims.',
  },
  {
    name: 'Raj Laxkar',
    role: 'Daily Accounts / Accountant',
    department: 'Accounts',
    color: '#f59e0b',
    status: 'active',
    mobile_number: '9829100003',
    email: 'raj@anjanimedical.in',
    notification_preference: 'App',
    timing: 'Split duty around 2:00 PM and 9:45 PM daily',
    main_responsibility: '2 PM cash handover, wholesaler management, 9:45 PM closing, cash verification and overtime verification.',
  },
]

export async function resetToSampleData() {
  await clearAllData()

  const createdStaff = await Promise.allSettled(
    SAMPLE_STAFF.map((s) => apiFetch('/staff', { method: 'POST', body: JSON.stringify(s) }))
  )
  const firstId = createdStaff[0]?.value?.id ?? null
  const today = new Date().toISOString().split('T')[0]

  const sampleTasks = [
    { title: 'Morning Stock Check',   description: 'Check expiry dates and reorder fast-moving items', category: 'Stock Audit', priority: 'high',     status: 'pending', assigned_to: firstId, due_date: today, due_time: '10:00' },
    { title: 'RGHS Billing Update',   description: 'Process pending RGHS claims for the week',         category: 'RGHS',        priority: 'critical', status: 'pending', assigned_to: firstId, due_date: today, due_time: '14:00' },
    { title: 'Evening Sales Report',  description: 'Compile daily sales figures and submit to manager', category: 'Sales',       priority: 'medium',   status: 'pending', assigned_to: firstId, due_date: today, due_time: '21:00' },
  ]
  await Promise.allSettled(
    sampleTasks.map((t) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(t) }))
  )
}
