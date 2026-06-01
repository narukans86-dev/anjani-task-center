const BASE = '/api'

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${text}`)
  }
  return res.json()
}

export const getStaff = () => req('/staff')
export const createStaff = (data) => req('/staff', { method: 'POST', body: JSON.stringify(data) })
export const updateStaff = (id, data) => req(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteStaff = (id) => req(`/staff/${id}`, { method: 'DELETE' })

export const getTasks = (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  return req(`/tasks${params ? `?${params}` : ''}`)
}
export const getTodayTasks = () => req('/tasks/today')
export const getTaskStats = () => req('/tasks/stats')
export const createTask = (data) => req('/tasks', { method: 'POST', body: JSON.stringify(data) })
export const updateTask = (id, data) => req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const updateTaskStatus = (id, status) => req(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const deleteTask = (id) => req(`/tasks/${id}`, { method: 'DELETE' })

// ── Checklists ─────────────────────────────────────────────────────────────
export const getChecklists = (type) => req(`/checklists${type ? `?type=${type}` : ''}`)
export const getTodayChecklists = () => req('/checklists/today')
export const completeChecklistItem = (checklist_id, staff_id, notes) =>
  req('/checklists/complete', { method: 'POST', body: JSON.stringify({ checklist_id, staff_id, notes }) })
export const uncompleteChecklistItem = (completionId) =>
  req(`/checklists/complete/${completionId}`, { method: 'DELETE' })
export const getChecklistStats = () => req('/checklists/stats')

// ── Notifications ──────────────────────────────────────────────────────────
export const getNotifications = () => req('/notifications')
export const getUnreadCount = () => req('/notifications/unread-count')
export const markNotificationRead = (id) => req(`/notifications/${id}/read`, { method: 'PATCH' })
export const markAllRead = () => req('/notifications/read-all', { method: 'PATCH' })
export const deleteNotification = (id) => req(`/notifications/${id}`, { method: 'DELETE' })
export const generateNotifications = () => req('/notifications/generate', { method: 'POST' })
export const generateRefillNotifications = () => req('/notifications/generate-refill', { method: 'POST' })

// ── Audit ──────────────────────────────────────────────────────────────────
export const getAuditLogs = (page = 1, limit = 50) =>
  req(`/audit?page=${page}&limit=${limit}`)
export const createAuditLog = (entry) =>
  req('/audit', { method: 'POST', body: JSON.stringify(entry) })

// ── Reports ────────────────────────────────────────────────────────────────
export const getStaffPerformanceReport = () => req('/reports/staff-performance')
export const getDepartmentReport = () => req('/reports/department')
export const getDailyReport = () => req('/reports/daily')
export const getPriorityReport = () => req('/reports/priority')
