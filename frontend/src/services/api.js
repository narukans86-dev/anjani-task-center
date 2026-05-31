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
