const USERS = [
  { id: 1, username: 'admin',   password: 'admin123',   name: 'Administrator',  role: 'admin' },
  { id: 2, username: 'manager', password: 'manager123', name: 'Store Manager',  role: 'manager' },
  { id: 3, username: 'staff',   password: 'staff123',   name: 'Staff Member',   role: 'staff' },
]

const KEY = 'anjani_user'

export function login(username, password) {
  const user = USERS.find((u) => u.username === username && u.password === password)
  if (!user) return { success: false, error: 'Invalid credentials' }
  const { password: _, ...safe } = user
  localStorage.setItem(KEY, JSON.stringify(safe))
  return { success: true, user: safe }
}

export function logout() {
  localStorage.removeItem(KEY)
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return getCurrentUser() !== null
}
