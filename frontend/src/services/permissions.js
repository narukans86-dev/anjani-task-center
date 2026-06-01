export const ROLES = ['admin', 'manager', 'staff', 'viewer']

export const PERMISSIONS = {
  admin: [
    'view_dashboard', 'manage_staff', 'manage_tasks',
    'assign_tasks', 'view_reports', 'access_settings',
    'export_data', 'import_data', 'delete_staff', 'delete_tasks',
  ],
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

export const ROUTE_ROLES = {
  dashboard: ['admin', 'manager', 'staff', 'viewer'],
  tasks:     ['admin', 'manager', 'staff'],
  staff:     ['admin', 'manager'],
  audit:     ['admin'],
  settings:  ['admin'],
  reports:   ['admin', 'manager', 'viewer'],
  calendar:  ['admin', 'manager', 'staff', 'viewer'],
  checklist: ['admin', 'manager', 'staff'],
  dailyRoutine: ['admin', 'manager', 'staff', 'viewer'],
}

export function hasPermission(user, permission) {
  if (!user) return false
  return (PERMISSIONS[user.role] ?? []).includes(permission)
}

export function hasRole(user, allowedRoles = []) {
  if (!user) return false
  if (!ROLES.includes(user.role)) return false
  return allowedRoles.length === 0 || allowedRoles.includes(user.role)
}
