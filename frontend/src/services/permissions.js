export const ROLES = ['admin', 'manager', 'staff', 'viewer']

/**
 * Returns the fine-grained access role for a user.
 * Uses user.access_role if set (e.g. 'sales_manager').
 * Falls back to mapping the DB role: manager → decision_manager.
 */
export function getEffectiveRole(user) {
  if (!user) return null
  if (user.access_role) return user.access_role
  if (user.role === 'admin')   return 'admin'
  if (user.role === 'manager') return 'decision_manager'
  return user.role // 'staff' | 'viewer'
}

export const PERMISSIONS = {
  admin: [
    'view_dashboard', 'manage_staff', 'manage_tasks',
    'assign_tasks', 'view_reports', 'access_settings',
    'export_data', 'import_data', 'delete_staff', 'delete_tasks',
    'manage_users',
  ],
  // Full operational manager — store/decision manager
  decision_manager: [
    'view_dashboard', 'manage_tasks', 'assign_tasks',
    'view_reports', 'view_staff', 'export_data',
  ],
  // Sales Manager (Rakesh) — limited operational access
  sales_manager: [
    'view_dashboard', 'view_own_tasks', 'manage_tasks', 'assign_tasks',
    'view_reports',
  ],
  // Legacy fallback for role='manager' without access_role
  manager: [
    'view_dashboard', 'manage_tasks', 'assign_tasks',
    'view_reports', 'view_staff', 'export_data',
  ],
  staff: [
    'view_dashboard', 'view_own_tasks', 'update_own_task_status',
  ],
  viewer: [
    'view_dashboard', 'view_reports', 'view_calendar',
  ],
}

// Routes keyed by routeKey — values are EFFECTIVE roles (not DB roles)
export const ROUTE_ROLES = {
  dashboard:       ['admin', 'decision_manager', 'sales_manager', 'staff', 'viewer'],
  tasks:           ['admin', 'decision_manager', 'sales_manager', 'staff'],
  checklist:       ['admin', 'decision_manager', 'sales_manager', 'staff'],
  dailyRoutine:    ['admin', 'decision_manager', 'sales_manager', 'staff', 'viewer'],
  incentives:      ['admin', 'decision_manager', 'sales_manager'],
  // staff management — decision_manager and admin only (Rakesh excluded)
  staff:           ['admin', 'decision_manager'],
  audit:           ['admin'],
  settings:        ['admin'],
  reports:         ['admin'],
  calendar:        ['admin', 'decision_manager', 'sales_manager', 'staff', 'viewer'],
  patientRefill:   ['admin', 'decision_manager', 'sales_manager', 'staff'],
  refillDashboard: ['admin', 'decision_manager', 'sales_manager'],
  quoteEditor:     ['admin'],
}

export function hasPermission(user, permission) {
  if (!user) return false
  const effectiveRole = getEffectiveRole(user)
  const perms = PERMISSIONS[effectiveRole] ?? PERMISSIONS[user.role] ?? []
  return perms.includes(permission)
}

export function hasRole(user, allowedRoles = []) {
  if (!user) return false
  if (!ROLES.includes(user.role)) return false
  const effectiveRole = getEffectiveRole(user)
  return allowedRoles.length === 0 || allowedRoles.includes(effectiveRole)
}
