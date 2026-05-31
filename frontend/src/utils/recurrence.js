const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' }

function parseDays(task) {
  if (!task.recurrence_days) return []
  if (Array.isArray(task.recurrence_days)) return task.recurrence_days
  try { return JSON.parse(task.recurrence_days) } catch { return [] }
}

export function isTaskDueOnDate(task, dateString) {
  if (!task.is_recurring) {
    return task.due_date === dateString
  }

  const type = task.recurrence_type || 'none'
  if (type === 'none') return task.due_date === dateString

  // respect recurrence_end_date
  if (task.recurrence_end_date && dateString > task.recurrence_end_date) return false
  // don't show before the task's own due_date (start date)
  if (task.due_date && dateString < task.due_date) return false

  const d = new Date(dateString + 'T00:00:00')
  const weekday = DAY_ABBR[d.getDay()]

  if (type === 'daily') return true

  if (type === 'weekly' || type === 'custom') {
    const days = parseDays(task)
    return days.includes(weekday)
  }

  if (type === 'monthly') {
    if (!task.due_date) return false
    const startDay = parseInt(task.due_date.slice(8, 10), 10)
    return d.getDate() === startDay
  }

  return false
}

export function getRecurrenceLabel(task) {
  if (!task.is_recurring) return ''
  const type = task.recurrence_type || 'none'
  if (type === 'none') return ''
  if (type === 'daily') return 'Daily'
  if (type === 'monthly') return 'Monthly'
  if (type === 'weekly' || type === 'custom') {
    const days = parseDays(task)
    if (!days.length) return type === 'weekly' ? 'Weekly' : 'Custom'
    const labels = days.map((d) => DAY_LABELS[d] || d).join(', ')
    return `${type === 'weekly' ? 'Weekly' : 'Custom'} (${labels})`
  }
  return type
}

export function getNextOccurrence(task, fromDate) {
  const type = task.recurrence_type || 'none'
  if (!task.is_recurring || type === 'none') return task.due_date || null

  let cursor = new Date(fromDate + 'T00:00:00')
  cursor.setDate(cursor.getDate() + 1) // start from day after fromDate

  const end = task.recurrence_end_date ? new Date(task.recurrence_end_date + 'T00:00:00') : null
  const limit = new Date(cursor)
  limit.setFullYear(limit.getFullYear() + 1)

  while (cursor <= limit) {
    if (end && cursor > end) return null
    const ds = cursor.toISOString().slice(0, 10)
    if (isTaskDueOnDate(task, ds)) return ds
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}
