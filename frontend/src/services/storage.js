const SETTINGS_KEY = 'anjani_settings'

export const DEFAULT_SETTINGS = {
  companyName: 'Anjani Medical',
  branchName: 'Main Branch',
  workingHoursStart: '09:00',
  workingHoursEnd: '21:00',
  defaultCategories: [
    'Sales', 'Purchase', 'Stock Audit', 'RGHS', 'Customer Support',
    'Delivery', 'Billing', 'Expiry Return', 'Admin', 'Cleaning',
  ],
  defaultDepartments: ['Pharmacy', 'Billing', 'Delivery', 'Admin', 'Support'],
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
  { name: 'Rajesh Kumar',  role: 'Pharmacist',        department: 'Pharmacy', color: '#3b82f6', status: 'active' },
  { name: 'Priya Sharma',  role: 'Billing Executive',  department: 'Billing',  color: '#8b5cf6', status: 'active' },
  { name: 'Anil Verma',    role: 'Delivery Boy',       department: 'Delivery', color: '#f59e0b', status: 'active' },
  { name: 'Sunita Patel',  role: 'Store Manager',      department: 'Admin',    color: '#10b981', status: 'active' },
  { name: 'Deepak Singh',  role: 'Customer Support',   department: 'Support',  color: '#ef4444', status: 'active' },
  { name: 'Meera Joshi',   role: 'Pharmacist',         department: 'Pharmacy', color: '#ec4899', status: 'active' },
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
