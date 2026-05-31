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
}

export function hasPermission(user, permission) {
  if (!user) return false
  return (PERMISSIONS[user.role] ?? []).includes(permission)
}
