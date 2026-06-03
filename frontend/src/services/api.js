const BASE = '/api'

function getAuthToken() {
  try {
    const raw = localStorage.getItem('anjani_user')
    return raw ? (JSON.parse(raw)?.token ?? null) : null
  } catch { return null }
}

async function req(path, options = {}) {
  const token = getAuthToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
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
export const createChecklist = (data) => req('/checklists', { method: 'POST', body: JSON.stringify(data) })
export const updateChecklist = (id, data) => req(`/checklists/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteChecklist = (id) => req(`/checklists/${id}`, { method: 'DELETE' })

export const completeChecklistItem = (checklist_id, staff_id, notes) =>
  req('/checklists/complete', { method: 'POST', body: JSON.stringify({ checklist_id, staff_id, notes }) })
export const uncompleteChecklistItem = (completionId) =>
  req(`/checklists/complete/${completionId}`, { method: 'DELETE' })
export const getChecklistStats = () => req('/checklists/stats')

// ── Task Templates ─────────────────────────────────────────────────────────
export const getTaskTemplates = (activeOnly = false) => req(`/task-templates${activeOnly ? '?active=true' : ''}`)
export const createTaskTemplate = (data) => req('/task-templates', { method: 'POST', body: JSON.stringify(data) })
export const updateTaskTemplate = (id, data) => req(`/task-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteTaskTemplate = (id) => req(`/task-templates/${id}`, { method: 'DELETE' })

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
export const clearAuditLogs = () =>
  req('/audit/clear', { method: 'DELETE' })

// ── Reports ────────────────────────────────────────────────────────────────
export const getStaffPerformanceReport = () => req('/reports/staff-performance')
export const getDepartmentReport = () => req('/reports/department')
export const getDailyReport = () => req('/reports/daily')
export const getPriorityReport = () => req('/reports/priority')

// ── Daily Routine Templates ────────────────────────────────────────────────
export const getDailyRoutineTemplates = (activeOnly = false, type = null) => {
  let url = `/daily-routine/templates${activeOnly ? '?active=true' : ''}`
  if (type) {
    url += `${activeOnly ? '&' : '?'}routine_type=${encodeURIComponent(type)}`
  }
  return req(url)
}
export const createDailyRoutineTemplate = (data) => req('/daily-routine/templates', { method: 'POST', body: JSON.stringify(data) })
export const updateDailyRoutineTemplate = (id, data) => req(`/daily-routine/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteDailyRoutineTemplate = (id) => req(`/daily-routine/templates/${id}`, { method: 'DELETE' })

// ── Notification extras ────────────────────────────────────────────────────
export const completeNotification  = (id)  => req(`/notifications/${id}/complete`, { method: 'PATCH' })
export const sendTestNotification  = ()    => req('/notifications/test-me', { method: 'POST' })

// ── Notification settings ──────────────────────────────────────────────────
export const getNotificationSettings  = ()     => req('/notification-settings')
export const saveNotificationSettings = (data) => req('/notification-settings', { method: 'PUT', body: JSON.stringify(data) })

// ── My Profile ────────────────────────────────────────────────────────────
export const getMe            = ()     => req('/auth/me')
export const updateMyProfile  = (data) => req('/auth/me/profile', { method: 'PUT', body: JSON.stringify(data) })

// ── Users & Roles (admin) ──────────────────────────────────────────────────
export const getUsers          = ()            => req('/users')
export const createUser        = (data)        => req('/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser        = (id, data)    => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const resetUserPassword = (id, pwd)     => req(`/users/${id}/reset-password`, { method: 'PATCH', body: JSON.stringify({ newPassword: pwd }) })
export const setUserStatus     = (id, status)  => req(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
