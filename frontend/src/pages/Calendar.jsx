import { useState, useEffect, useCallback, useMemo } from 'react'
import { getTasks, getStaff, updateTaskStatus } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'

const PRIORITY_DOT = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#475569',
}

const PRIORITY_BORDER = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#475569',
}

const STATUS_CFG = {
  pending:     { label: 'Pending',     cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  delayed:     { label: 'Delayed',     cls: 'bg-red-50 text-red-600 border border-red-200' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const PRIORITY_BADGE = {
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-600 border border-red-200' },
  high:     { label: 'High',     cls: 'bg-orange-50 text-orange-600 border border-orange-200' },
  medium:   { label: 'Medium',   cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  low:      { label: 'Low',      cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DATE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
]

function pad(n) { return String(n).padStart(2, '0') }
function todayStr() { return new Date().toISOString().slice(0, 10) }

function isOpenTask(task) {
  return task.status !== 'completed' && task.status !== 'cancelled'
}

function isOverdueTask(task, today) {
  return Boolean(task.due_date && task.due_date < today && isOpenTask(task))
}

function matchesDateFilter(task, filter, today) {
  if (filter === 'pending') return task.status === 'pending' || task.status === 'in_progress'
  if (filter === 'completed') return task.status === 'completed'
  if (filter === 'overdue') return isOverdueTask(task, today)
  return true
}

function taskSort(a, b) {
  const rank = { critical: 1, high: 2, medium: 3, low: 4 }
  return (rank[a.priority] || 9) - (rank[b.priority] || 9)
    || (a.due_time || '23:59').localeCompare(b.due_time || '23:59')
    || a.title.localeCompare(b.title)
}

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function TaskListItem({ task, staffList, onComplete, completing, canComplete, today }) {
  const st = STATUS_CFG[task.status] || STATUS_CFG.pending
  const priority = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low
  const assignee = staffList.find((s) => String(s.id) === String(task.assigned_to))
  const borderColor = PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.low
  const overdue = isOverdueTask(task, today)

  return (
    <div
      className="p-3 rounded-xl bg-white/95 border border-[#D1DCF0] hover:bg-blue-50/50 transition-colors shadow-sm"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-[#111827]'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${priority.cls}`}>{priority.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
            {overdue && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                Overdue
              </span>
            )}
            {task.category && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#0A3D91] border border-blue-100">
                {task.category}
              </span>
            )}
          </div>
          {assignee && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                style={{ background: (assignee.color || '#3b82f6') + '22', color: assignee.color || '#3b82f6' }}
              >
                {initials(assignee.name)}
              </div>
              <span className="text-slate-400 text-[10px]">{assignee.name}</span>
            </div>
          )}
          {task.due_time && (
            <p className="text-slate-500 text-[10px] mt-1">{task.due_time}</p>
          )}
        </div>
        {canComplete && task.status !== 'completed' && (
          <button
            onClick={() => onComplete(task.id)}
            disabled={completing === task.id}
            className="shrink-0 w-8 h-8 rounded-lg bg-[#0A3D91] flex items-center justify-center text-white hover:bg-[#0057D9] transition-colors disabled:opacity-50"
            title="Mark complete"
            aria-label={`Mark ${task.title} complete`}
          >
            {completing === task.id
              ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              : <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            }
          </button>
        )}
      </div>
    </div>
  )
}

export default function Calendar() {
  const { toasts, add: toast, remove: removeToast } = useToast()
  const { user } = useAuth()

  const today = todayStr()
  const [curDate, setCurDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(today)

  const [allTasks, setAllTasks]   = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading]     = useState(true)
  const [completing, setCompleting] = useState(null)
  const [dateFilter, setDateFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const [tasksData, staffData] = await Promise.all([getTasks(), getStaff()])
      setAllTasks(tasksData)
      setStaffList(staffData)
    } catch (e) {
      toast(`Failed to load: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function quickComplete(taskId) {
    if (user?.role === 'viewer') return

    setCompleting(taskId)
    try {
      await updateTaskStatus(taskId, 'completed')
      toast('Task marked complete', 'success')
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setCompleting(null)
    }
  }

  const { year, month } = curDate
  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMon = new Date(year, month + 1, 0).getDate()

  const myStaffId = useMemo(() => {
    if (user?.role !== 'staff') return null
    const match = staffList.find((s) => s.name === user.name)
    return match ? match.id : null
  }, [user, staffList])

  const visibleTasks = useMemo(() => {
    if (user?.role !== 'staff') return allTasks
    if (myStaffId === null) return []
    return allTasks.filter((t) => String(t.assigned_to) === String(myStaffId))
  }, [user, allTasks, myStaffId])

  const canCompleteTasks = user?.role !== 'viewer'

  const filteredVisibleTasks = useMemo(() => {
    return visibleTasks.filter((task) => matchesDateFilter(task, dateFilter, today))
  }, [visibleTasks, dateFilter, today])

  const tasksByDate = useMemo(() => filteredVisibleTasks.reduce((acc, t) => {
    if (t.due_date) {
      acc[t.due_date] = acc[t.due_date] ? [...acc[t.due_date], t] : [t]
    }
    return acc
  }, {}), [filteredVisibleTasks])

  const selectedAllTasks = useMemo(() => {
    return visibleTasks
      .filter((task) => task.due_date === selectedDate)
      .sort(taskSort)
  }, [visibleTasks, selectedDate])

  const selectedTasks = useMemo(() => {
    return selectedAllTasks
      .filter((task) => matchesDateFilter(task, dateFilter, today))
      .sort(taskSort)
  }, [selectedAllTasks, dateFilter, today])

  const selectedStats = useMemo(() => {
    const completed = selectedAllTasks.filter((task) => task.status === 'completed').length
    const overdue = selectedAllTasks.filter((task) => isOverdueTask(task, today)).length
    return {
      total: selectedAllTasks.length,
      completed,
      overdue,
      pending: selectedAllTasks.filter((task) => task.status === 'pending' || task.status === 'in_progress').length,
    }
  }, [selectedAllTasks, today])

  const monthSummary = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}-`
    const monthTasks = visibleTasks.filter((task) => task.due_date?.startsWith(prefix))
    return {
      total: monthTasks.length,
      overdue: monthTasks.filter((task) => isOverdueTask(task, today)).length,
    }
  }, [visibleTasks, year, month, today])

  const calCells = []
  for (let i = 0; i < firstDay; i++) calCells.push(null)
  for (let d = 1; d <= daysInMon; d++) calCells.push(d)

  function prevMonth() {
    setCurDate(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })
  }
  function nextMonth() {
    setCurDate(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })
  }
  function goToday() {
    const d = new Date()
    setCurDate({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedDate(today)
  }

  const selDateLabel = (() => {
    if (!selectedDate) return ''
    const d = new Date(selectedDate + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  })()

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto overflow-x-hidden">
      <div className="mb-5 rounded-2xl border border-[#D1DCF0] bg-white/90 p-4 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)]">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[#0A3D91] text-xs font-bold tracking-[0.16em] uppercase mb-1">Operations Calendar</p>
            <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Calendar</h2>
            <p className="text-slate-500 text-sm mt-1">Track workload, overdue dates, and daily task flow.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-2 rounded-lg border border-[#D1DCF0] bg-white text-[#0A3D91] text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-[#D1DCF0] bg-white p-1">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-lg text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50 transition-colors flex items-center justify-center"
                aria-label="Previous month"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-[9rem] text-center px-2">
                <p className="text-sm font-semibold text-[#111827]">{MONTHS[month]} {year}</p>
                <p className="text-[10px] text-slate-500">{monthSummary.total} tasks this month</p>
              </div>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-lg text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50 transition-colors flex items-center justify-center"
                aria-label="Next month"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setDateFilter(filter.key)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                  dateFilter === filter.key
                    ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                    : 'bg-white text-slate-600 border-[#D1DCF0] hover:bg-blue-50 hover:text-[#0A3D91]',
                ].join(' ')}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {monthSummary.overdue > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {monthSummary.overdue} overdue this month
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] gap-5">
        <section className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-3 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)] min-w-0">
          <div className="grid grid-cols-7 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="text-center text-slate-500 text-[10px] sm:text-xs font-semibold py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="aspect-square min-w-0" />

              const ds = `${year}-${pad(month + 1)}-${pad(day)}`
              const isToday = ds === today
              const isSel = ds === selectedDate
              const dayTasks = tasksByDate[ds] ?? []
              const hasTasks = dayTasks.length > 0
              const hasOverdue = dayTasks.some((task) => isOverdueTask(task, today))
              const dotColors = [...new Set(dayTasks.map((t) => PRIORITY_DOT[t.priority] || PRIORITY_DOT.low))]

              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  className={[
                    'relative aspect-square min-w-0 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-xs sm:text-sm font-semibold outline-none',
                    isSel
                      ? 'bg-[#0A3D91] text-white border-[#0A3D91] shadow-md ring-2 ring-blue-200'
                      : isToday
                      ? 'bg-white text-[#0A3D91] border-[#0A3D91] shadow-sm'
                      : hasTasks
                      ? 'bg-blue-50/70 text-[#111827] border-blue-100 hover:border-[#0A3D91] hover:bg-white'
                      : 'bg-white/70 text-slate-400 border-transparent hover:bg-blue-50/70',
                  ].join(' ')}
                  aria-label={`${ds}, ${dayTasks.length} tasks`}
                >
                  {hasTasks && (
                    <span className={[
                      'absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full text-[9px] leading-4 font-bold',
                      isSel ? 'bg-white/20 text-white' : 'bg-white text-[#0A3D91] border border-blue-100',
                    ].join(' ')}>
                      {dayTasks.length}
                    </span>
                  )}
                  <span>{day}</span>
                  {hasTasks && (
                    <div className="flex gap-0.5 min-h-[5px]">
                      {dotColors.slice(0, 4).map((c, ci) => (
                        <span
                          key={ci}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.76)' : c }}
                        />
                      ))}
                    </div>
                  )}
                  {hasOverdue && (
                    <span className={[
                      'absolute bottom-1 left-1 right-1 h-1 rounded-full',
                      isSel ? 'bg-white/65' : 'bg-red-400',
                    ].join(' ')} />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mt-4 pt-4 border-t border-[#E8EFFF] flex-wrap">
            {Object.entries(PRIORITY_DOT).map(([p, c]) => (
              <div key={p} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-slate-500 text-[10px] capitalize">{p}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-1 rounded-full bg-red-400" />
              <span className="text-slate-500 text-[10px]">Overdue date</span>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-4 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)] min-w-0 flex flex-col">
          <div className="border-b border-[#E8EFFF] pb-4 mb-4">
            {selectedDate ? (
              <>
                <p className="text-[#111827] font-semibold text-base">{selDateLabel}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {dateFilter === 'all' ? 'All tasks for selected date' : `${DATE_FILTERS.find((f) => f.key === dateFilter)?.label} view`}
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm">Select a date</p>
            )}

            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                { label: 'Total', value: selectedStats.total, cls: 'bg-blue-50 text-[#0A3D91] border-blue-100' },
                { label: 'Completed', value: selectedStats.completed, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { label: 'Pending', value: selectedStats.pending, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                { label: 'Overdue', value: selectedStats.overdue, cls: 'bg-red-50 text-red-600 border-red-100' },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl border p-3 ${item.cls}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{item.label}</p>
                  <p className="text-xl font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[34rem] pr-0.5">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)
              : selectedTasks.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <p className="text-slate-500 text-sm">
                    {selectedStats.total === 0 ? 'No tasks on this date' : 'No tasks match this filter'}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {selectedStats.total === 0 ? 'Task creation will stay on the Tasks page for now.' : 'Switch filters to see other tasks for this date.'}
                  </p>
                </div>
              )
              : selectedTasks.map((t) => (
                <TaskListItem
                  key={t.id}
                  task={t}
                  staffList={staffList}
                  onComplete={quickComplete}
                  completing={completing}
                  canComplete={canCompleteTasks}
                  today={today}
                />
              ))
            }
          </div>
        </aside>
      </div>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
