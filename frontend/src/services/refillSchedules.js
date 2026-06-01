async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getAllRefillSchedules(filters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, v)
  }
  const qs = params.toString()
  const result = await apiFetch(`/refill-schedules${qs ? `?${qs}` : ''}`)
  return Array.isArray(result) ? result : (result.data ?? [])
}

export async function getUpcomingRefills(days = 7) {
  const result = await apiFetch(`/refill-schedules/upcoming?days=${days}`)
  return Array.isArray(result) ? result : (result.data ?? [])
}

export async function getRefillSchedule(id) {
  return apiFetch(`/refill-schedules/${id}`)
}

// ── Write ──────────────────────────────────────────────────────────────────

export async function addRefillSchedule(data) {
  return apiFetch('/refill-schedules', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateRefillSchedule(id, data) {
  return apiFetch(`/refill-schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function pauseRefillSchedule(id) {
  return apiFetch(`/refill-schedules/${id}/pause`, { method: 'PATCH' })
}

export async function resumeRefillSchedule(id) {
  return apiFetch(`/refill-schedules/${id}/resume`, { method: 'PATCH' })
}

export async function updateWorkflowStatus(id, status, notes = '') {
  return apiFetch(`/refill-schedules/${id}/workflow-status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  })
}

// Soft-cancel by default; pass hard=true to permanently delete
export async function deleteRefillSchedule(id, { hard = false } = {}) {
  return apiFetch(`/refill-schedules/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' })
}
