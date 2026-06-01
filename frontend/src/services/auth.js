import { ROLES } from './permissions'

const KEY = 'anjani_user'

export async function login(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'Login failed. Check credentials.' }
    }

    const raw = data.user
    const role = (raw.role || '').toLowerCase()
    if (!ROLES.includes(role)) {
      return { success: false, error: 'Unknown role on this account. Contact admin.' }
    }

    // Normalize shape to match what existing UI expects
    const user = {
      ...raw,
      role,                                          // ensure lowercase
      name: raw.display_name || raw.username,        // backward compat
    }
    localStorage.setItem(KEY, JSON.stringify(user))
    return { success: true, user }
  } catch {
    return { success: false, error: 'Cannot reach server. Make sure the backend is running.' }
  }
}

export function logout() {
  const user = getCurrentUser()
  if (user?.token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
    }).catch(() => {})
  }
  localStorage.removeItem(KEY)
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const user = JSON.parse(raw)
    const role = (user?.role || '').toLowerCase()
    if (!ROLES.includes(role)) {
      localStorage.removeItem(KEY)
      return null
    }
    return user
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}

export function isAuthenticated() {
  return getCurrentUser() !== null
}

export async function changePassword(oldPassword, newPassword) {
  const user = getCurrentUser()
  if (!user?.token) return { success: false, error: 'Not authenticated.' }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ oldPassword, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Failed to change password.' }

    // Clear the force-change flag in localStorage
    const updated = { ...user, mustChangePassword: false }
    localStorage.setItem(KEY, JSON.stringify(updated))
    return { success: true }
  } catch {
    return { success: false, error: 'Server error. Please try again.' }
  }
}
