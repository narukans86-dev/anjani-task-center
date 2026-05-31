import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getTodayTasks, getTaskStats, getStaff, getTasks, updateTaskStatus, getChecklistStats } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'
import { generateTaskNotifications } from '../utils/notificationGenerator'

const BRAND_BLUE = '#0A3D91'

const PRIORITY_META = {
  critical: { label: 'Critical', color: '#ef4444', rank: 1 },
  urgent:   { label: 'Urgent',   color: '#ef4444', rank: 2 },
  high:     { label: 'High',     color: '#f97316', rank: 3 },
  medium:   { label: 'Medium',   color: '#3b82f6', rank: 4 },
  low:      { label: 'Low',      color: '#475569', rank: 5 },
}

const STATUS_CFG = {
  pending:     { label: 'Pending',     cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  delayed:     { label: 'Delayed',     cls: 'bg-red-50 text-red-600 border border-red-200' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const ROLE_BADGE = {
  admin:   { label: 'Admin',   cls: 'bg-[#0A3D91] text-white border-transparent' },
  manager: { label: 'Manager', cls: 'bg-teal-600 text-white border-transparent' },
  staff:   { label: 'Staff',   cls: 'bg-slate-500 text-white border-transparent' },
  viewer:  { label: 'Viewer',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEPT_COLORS = [
  '#14b8a6','#8b5cf6','#f59e0b','#3b82f6','#ef4444',
  '#ec4899','#10b981','#f97316','#6366f1','#06b6d4',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toDateLabel(key, options = {}) {
  if (!key) return ''
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...options,
  })
}

function initials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function isOpenTask(task) {
  return task.status !== 'completed' && task.status !== 'cancelled'
}

function isOverdue(task, today) {
  return Boolean(task.due_date && task.due_date < today && isOpenTask(task))
}

function isHighPriority(task) {
  return ['critical', 'urgent', 'high'].includes(task.priority)
}

function taskRank(task) {
  return PRIORITY_META[task.priority]?.rank ?? 9
}

function taskTime(task) {
  return `${task.due_date || '9999-12-31'} ${task.due_time || '23:59'}`
}

function sortOperationalTasks(a, b) {
  return taskRank(a) - taskRank(b) || taskTime(a).localeCompare(taskTime(b)) || a.title.localeCompare(b.title)
}

function performanceStatus(percent, total) {
  if (total === 0) {
    return { label: 'No tasks', cls: 'bg-slate-100 text-slate-500 border-slate-200', bar: '#94a3b8' }
  }
  if (percent >= 85) {
    return { label: 'Excellent', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10b981' }
  }
  if (percent >= 60) {
    return { label: 'Good', cls: 'bg-blue-50 text-blue-700 border-blue-200', bar: BRAND_BLUE }
  }
  return { label: 'Needs attention', cls: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#f59e0b' }
}

function Icon({ name, className = 'w-5 h-5' }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (name === 'check') return (
    <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>
  )
  if (name === 'clipboard') return (
    <svg {...common}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" /></svg>
  )
  if (name === 'clock') return (
    <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
  )
  if (name === 'alert') return (
    <svg {...common}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
  )
  if (name === 'flame') return (
    <svg {...common}><path d="M8.5 14.5A4.5 4.5 0 0 0 17 12c0-4-4-6-4-9-2.5 1.6-4 4-4 6.5 0 1.5.5 2.5 1 3.5-1.2-.3-2.2-1-3-2C6.4 12.2 6 13.4 6 15a6 6 0 0 0 12 0c0-1.5-.4-2.8-1.2-4" /></svg>
  )
  if (name === 'calendar') return (
    <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  )
  if (name === 'users') return (
    <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  )
  if (name === 'arrow-left') return (
    <svg {...common}><path d="m15 18-6-6 6-6" /></svg>
  )
  if (name === 'arrow-right') return (
    <svg {...common}><path d="m9 18 6-6-6-6" /></svg>
  )
  return (
    <svg {...common}><circle cx="12" cy="12" r="10" /></svg>
  )
}

function Card({ children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-[#D1DCF0] shadow-sm ${className}`}>
      {children}
    </section>
  )
}

function SectionHeader({ title, action, subtitle }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-[#111827] font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ label, value, color, icon, loading }) {
  const palette = {
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'text-[#0A3D91]', val: 'text-[#0A3D91]' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', val: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: 'text-amber-600',   val: 'text-amber-600' },
    red:     { bg: 'bg-red-50',     border: 'border-red-100',     icon: 'text-red-500',     val: 'text-red-500' },
    slate:   { bg: 'bg-slate-50',   border: 'border-slate-100',   icon: 'text-slate-600',   val: 'text-slate-700' },
  }[color]

  return (
    <Card className="p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-xl ${palette.bg} border ${palette.border} flex items-center justify-center shrink-0`}>
          <span className={palette.icon}><Icon name={icon} /></span>
        </div>
        <div className="min-w-0">
          {loading
            ? <div className="h-7 w-12 bg-slate-100 rounded animate-pulse mb-1" />
            : <p className={`text-2xl font-bold tabular-nums ${palette.val}`}>{value}</p>
          }
          <p className="text-slate-500 text-xs font-medium leading-tight">{label}</p>
        </div>
      </div>
    </Card>
  )
}

function EmptyState({ icon = 'clipboard', title }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <span className="text-slate-300"><Icon name={icon} className="w-8 h-8" /></span>
      <p className="text-slate-500 text-sm">{title}</p>
    </div>
  )
}

function TaskBadge({ children, className = '' }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

function TaskListItem({ task, staffList, onComplete, completing, compact = false }) {
  const st = STATUS_CFG[task.status] || STATUS_CFG.pending
  const assignee = staffList.find((s) => String(s.id) === String(task.assigned_to))
  const priority = PRIORITY_META[task.priority] || PRIORITY_META.low

  return (
    <div
      className={`flex items-start gap-3 rounded-xl bg-white border border-[#D1DCF0] hover:bg-blue-50/50 transition-colors ${compact ? 'p-3' : 'p-3 sm:p-4'}`}
      style={{ borderLeft: `3px solid ${priority.color}` }}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-[#111827]'}`}>
          {task.title}
        </p>
        {!compact && task.description && (
          <p className="text-slate-500 text-xs mt-1 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <TaskBadge className={st.cls}>{st.label}</TaskBadge>
          <TaskBadge className="bg-slate-50 text-slate-600 border border-slate-200">{priority.label}</TaskBadge>
          {task.due_time && <span className="text-slate-500 text-[11px]">{task.due_time}</span>}
          {assignee && (
            <span className="text-slate-500 text-[11px] truncate max-w-[140px]">{assignee.name}</span>
          )}
        </div>
      </div>
      {task.status !== 'completed' && (
        <button
          onClick={() => onComplete(task.id)}
          disabled={completing === task.id}
          className="shrink-0 w-8 h-8 rounded-lg bg-[#0A3D91] flex items-center justify-center text-white hover:bg-[#0057D9] transition-colors disabled:opacity-50"
          title="Mark complete"
          aria-label={`Mark ${task.title} complete`}
        >
          {completing === task.id
            ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            : <Icon name="check" className="w-4 h-4" />
          }
        </button>
      )}
    </div>
  )
}

function StaffPerformance({ loading, staffPerformance }) {
  return (
    <Card className="p-5">
      <SectionHeader
        title="Staff-wise Completion"
        subtitle="Sorted by completion rate across assigned tasks."
      />
      <div className="mt-5 space-y-4 overflow-y-auto max-h-[28rem] pr-1">
        {loading
          ? [1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)
          : staffPerformance.length === 0
          ? <EmptyState icon="users" title="No staff records found" />
          : staffPerformance.map((s) => {
              const status = performanceStatus(s.percent, s.total)
              return (
                <div key={s.id} className="rounded-xl border border-[#D1DCF0] bg-slate-50/60 p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ background: (s.color || BRAND_BLUE) + '18', border: `1.5px solid ${(s.color || BRAND_BLUE)}44`, color: s.color || BRAND_BLUE }}
                    >
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[#111827] text-sm font-semibold truncate">{s.name}</p>
                        <span className="text-[#111827] text-xs font-bold tabular-nums">{s.percent}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-slate-500 text-[11px] truncate">{s.completed}/{s.total} completed</p>
                        <TaskBadge className={`border ${status.cls}`}>{status.label}</TaskBadge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.percent}%`, backgroundColor: status.bar }}
                    />
                  </div>
                </div>
              )
            })
        }
      </div>
    </Card>
  )
}

function CalendarCard({ loading, year, month, today, tasksByDate, upcomingTasks, onPrev, onNext, onDateClick }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)

  const openUpcoming = upcomingTasks.filter(isOpenTask).length
  const todayLabel = toDateLabel(today, { weekday: 'long', year: 'numeric' })

  return (
    <Card className="p-5 overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 min-w-0">
          <SectionHeader
            title="Operations Calendar"
            subtitle={`Today is ${todayLabel}`}
            action={
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={onPrev}
                  className="w-8 h-8 rounded-lg border border-[#D1DCF0] text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50 transition-colors flex items-center justify-center"
                  aria-label="Previous month"
                >
                  <Icon name="arrow-left" className="w-4 h-4" />
                </button>
                <div className="min-w-[8.5rem] text-center px-2">
                  <p className="text-sm font-semibold text-[#111827]">{MONTHS[month]} {year}</p>
                </div>
                <button
                  onClick={onNext}
                  className="w-8 h-8 rounded-lg border border-[#D1DCF0] text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50 transition-colors flex items-center justify-center"
                  aria-label="Next month"
                >
                  <Icon name="arrow-right" className="w-4 h-4" />
                </button>
              </div>
            }
          />

          <div className="mt-5 rounded-2xl border border-[#D1DCF0] bg-gradient-to-b from-blue-50/70 to-white p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-slate-500 text-[10px] sm:text-xs font-semibold py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {loading
                ? Array.from({ length: 35 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-white/70 animate-pulse" />)
                : cells.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="aspect-square" />
                    const ds = `${year}-${pad(month + 1)}-${pad(day)}`
                    const isToday = ds === today
                    const dayTasks = tasksByDate[ds] ?? []
                    const openCount = dayTasks.filter(isOpenTask).length
                    const completedCount = dayTasks.filter((t) => t.status === 'completed').length
                    const dotColors = [...new Set(dayTasks.map((t) => PRIORITY_META[t.priority]?.color || PRIORITY_META.low.color))]

                    return (
                      <button
                        key={ds}
                        onClick={() => onDateClick(ds)}
                        className={[
                          'relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all text-xs sm:text-sm font-semibold outline-none',
                          isToday
                            ? 'bg-[#0A3D91] text-white shadow-md ring-2 ring-blue-200'
                            : dayTasks.length
                            ? 'bg-white text-[#111827] border border-blue-100 hover:border-[#0A3D91] hover:shadow-sm'
                            : 'bg-white/70 text-slate-400 border border-transparent hover:bg-white',
                        ].join(' ')}
                        aria-label={`${toDateLabel(ds, { year: 'numeric' })}, ${dayTasks.length} tasks`}
                      >
                        <span>{day}</span>
                        {dayTasks.length > 0 && (
                          <div className="flex items-center justify-center gap-0.5 min-h-[5px]">
                            {dotColors.slice(0, 3).map((color, ci) => (
                              <span
                                key={ci}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: isToday ? 'rgba(255,255,255,0.78)' : color }}
                              />
                            ))}
                          </div>
                        )}
                        {(openCount > 0 || completedCount > 0) && (
                          <span className={`text-[9px] leading-none ${isToday ? 'text-white/80' : 'text-slate-400'}`}>
                            {openCount > 0 ? openCount : completedCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 min-w-0">
          <div className="rounded-2xl bg-[#0A3D91] text-white p-4 mb-4">
            <p className="text-xs text-white/75">Upcoming workload</p>
            <div className="flex items-end justify-between gap-3 mt-2">
              <p className="text-3xl font-bold tabular-nums">{upcomingTasks.length}</p>
              <p className="text-xs text-white/75 text-right">{openUpcoming} open deadlines</p>
            </div>
          </div>

          <SectionHeader title="Upcoming Tasks" subtitle="Nearest deadlines across the task list." />
          <div className="mt-4 space-y-2 max-h-[24rem] overflow-y-auto pr-1">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)
              : upcomingTasks.length === 0
              ? <EmptyState icon="calendar" title="No upcoming deadlines" />
              : upcomingTasks.map((task) => {
                  const priority = PRIORITY_META[task.priority] || PRIORITY_META.low
                  return (
                    <button
                      key={task.id}
                      onClick={() => onDateClick(task.due_date)}
                      className="w-full text-left rounded-xl border border-[#D1DCF0] p-3 hover:bg-blue-50/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#111827] truncate">{task.title}</p>
                        <span
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: priority.color }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {toDateLabel(task.due_date, { weekday: 'short' })}
                        {task.due_time ? ` at ${task.due_time}` : ''}
                      </p>
                    </button>
                  )
                })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function PriorityColumn({ title, subtitle, icon, tone, tasks, staffList, onComplete, completing, loading }) {
  const toneClasses = {
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  }[tone]

  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${toneClasses}`}>
          <Icon name={icon} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[#111827] font-semibold truncate">{title}</h3>
            <span className="text-xs font-bold tabular-nums text-slate-500">{tasks.length}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
        {loading
          ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)
          : tasks.length === 0
          ? <EmptyState icon={icon} title="Nothing here right now" />
          : tasks.slice(0, 6).map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                staffList={staffList}
                onComplete={onComplete}
                completing={completing}
                compact
              />
            ))}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  const [todayTasks, setTodayTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [checklistStats, setChecklistStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)

  const [calDate, setCalDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const load = useCallback(async () => {
    try {
      const [todayData, statsData, staffData, allData, clStats] = await Promise.all([
        getTodayTasks(),
        getTaskStats(),
        getStaff(),
        getTasks(),
        getChecklistStats(),
      ])
      setTodayTasks(todayData)
      setStats(statsData)
      setStaffList(staffData)
      setAllTasks(allData)
      setChecklistStats(clStats)
      generateTaskNotifications(todayData)
    } catch {
      // Keep the last successful dashboard data during background refresh failures.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  async function quickComplete(taskId) {
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

  const today = dateKey()
  const todayDisplay = toDateLabel(today, { weekday: 'long', year: 'numeric' })

  const myStaffId = useMemo(() => {
    if (user?.role !== 'staff') return null
    const match = staffList.find((s) => s.name === user.name)
    return match ? match.id : null
  }, [user, staffList])

  const visibleTodayTasks = useMemo(() => {
    if (user?.role !== 'staff') return todayTasks
    if (myStaffId === null) return []
    return todayTasks.filter((t) => String(t.assigned_to) === String(myStaffId))
  }, [user, todayTasks, myStaffId])

  const visibleAllTasks = useMemo(() => {
    if (user?.role !== 'staff') return allTasks
    if (myStaffId === null) return []
    return allTasks.filter((t) => String(t.assigned_to) === String(myStaffId))
  }, [user, allTasks, myStaffId])

  const todayTotal = visibleTodayTasks.length
  const todayCompleted = visibleTodayTasks.filter((t) => t.status === 'completed').length
  const todayPending = visibleTodayTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length
  const overdueTasks = visibleAllTasks.filter((t) => isOverdue(t, today))
  const highPriorityToday = visibleTodayTasks.filter(isHighPriority).length

  const tasksByDate = useMemo(() => visibleAllTasks.reduce((acc, task) => {
    if (task.due_date) {
      acc[task.due_date] = acc[task.due_date] ? [...acc[task.due_date], task] : [task]
    }
    return acc
  }, {}), [visibleAllTasks])

  const upcomingTasks = useMemo(() => visibleAllTasks
    .filter((task) => task.due_date && task.due_date >= today && isOpenTask(task))
    .sort(sortOperationalTasks)
    .slice(0, 6), [visibleAllTasks, today])

  const staffPerformance = useMemo(() => staffList.map((staff) => {
    const assigned = allTasks.filter((task) => String(task.assigned_to) === String(staff.id))
    const completed = assigned.filter((task) => task.status === 'completed').length
    const percent = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0
    return { ...staff, total: assigned.length, completed, percent }
  }).sort((a, b) => b.percent - a.percent || b.total - a.total || a.name.localeCompare(b.name)), [staffList, allTasks])

  const urgentTasks = useMemo(() => visibleAllTasks
    .filter((task) => isOpenTask(task) && (isHighPriority(task) || isOverdue(task, today)))
    .sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)) || sortOperationalTasks(a, b)), [visibleAllTasks, today])

  const pendingQueue = useMemo(() => visibleAllTasks
    .filter((task) => isOpenTask(task) && !isHighPriority(task) && !isOverdue(task, today))
    .sort(sortOperationalTasks), [visibleAllTasks, today])

  const completedTasks = useMemo(() => visibleAllTasks
    .filter((task) => task.status === 'completed')
    .sort((a, b) => (b.completed_at || b.updated_at || b.created_at || '').localeCompare(a.completed_at || a.updated_at || a.created_at || ''))
    .slice(0, 8), [visibleAllTasks])

  const deptData = stats?.by_category ?? []
  const maxDept = Math.max(...deptData.map((d) => d.count), 1)
  const badge = ROLE_BADGE[user?.role] ?? ROLE_BADGE.staff
  const { year, month } = calDate

  function prevMonth() {
    setCalDate(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })
  }

  function nextMonth() {
    setCalDate(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })
  }

  function openDate(date) {
    navigate(`/tasks?date=${date}`)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Good {greeting()}, {user?.name ?? 'there'}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Anjani Medical operations view for {todayDisplay}.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white border border-[#D1DCF0] px-4 py-3 shadow-sm w-full sm:w-auto">
          <span className="text-[#0A3D91]"><Icon name="calendar" /></span>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Current month</p>
            <p className="text-sm font-semibold text-[#111827] truncate">{MONTHS[new Date().getMonth()]} {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Total Tasks Today" value={todayTotal} color="blue" icon="clipboard" loading={loading} />
        <StatCard label="Completed Today" value={todayCompleted} color="emerald" icon="check" loading={loading} />
        <StatCard label="Pending Today" value={todayPending} color="amber" icon="clock" loading={loading} />
        <StatCard label="Overdue Open" value={overdueTasks.length} color="red" icon="alert" loading={loading} />
        <StatCard label="High Priority Today" value={highPriorityToday} color="slate" icon="flame" loading={loading} />
      </div>

      <CalendarCard
        loading={loading}
        year={year}
        month={month}
        today={today}
        tasksByDate={tasksByDate}
        upcomingTasks={upcomingTasks}
        onPrev={prevMonth}
        onNext={nextMonth}
        onDateClick={openDate}
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className={`${user?.role === 'staff' ? 'xl:col-span-5' : 'xl:col-span-3'} p-5`}>
          <SectionHeader
            title="Today's Task Flow"
            subtitle="Live task list with quick completion."
            action={
              visibleTodayTasks.length > 0 && (
                <TaskBadge className="bg-blue-50 text-[#0A3D91] border border-blue-200">
                  {visibleTodayTasks.length} tasks
                </TaskBadge>
              )
            }
          />
          <div className="mt-4 overflow-y-auto max-h-96 space-y-2 pr-1">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)
              : visibleTodayTasks.length === 0
              ? <EmptyState title="No tasks scheduled for today" />
              : [...visibleTodayTasks].sort(sortOperationalTasks).map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    staffList={staffList}
                    onComplete={quickComplete}
                    completing={completing}
                  />
                ))}
          </div>
        </Card>

        {user?.role !== 'staff' && (
          <div className="xl:col-span-2 min-w-0">
            <StaffPerformance loading={loading} staffPerformance={staffPerformance} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PriorityColumn
          title="Urgent"
          subtitle="Overdue, critical, urgent, and high-priority work."
          icon="flame"
          tone="red"
          tasks={urgentTasks}
          staffList={staffList}
          onComplete={quickComplete}
          completing={completing}
          loading={loading}
        />
        <PriorityColumn
          title="Pending"
          subtitle="Open tasks that are not currently high-risk."
          icon="clock"
          tone="amber"
          tasks={pendingQueue}
          staffList={staffList}
          onComplete={quickComplete}
          completing={completing}
          loading={loading}
        />
        <PriorityColumn
          title="Completed"
          subtitle="Recently completed tasks for quick confirmation."
          icon="check"
          tone="emerald"
          tasks={completedTasks}
          staffList={staffList}
          onComplete={quickComplete}
          completing={completing}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeader title="Department Summary" subtitle="Task volume by category." />
          {loading
            ? [1, 2, 3, 4].map((i) => <div key={i} className="h-7 rounded bg-slate-100 animate-pulse mt-3" />)
            : deptData.length === 0
            ? <EmptyState title="No category data yet" />
            : (
              <div className="space-y-3 mt-4">
                {deptData.map((d, i) => (
                  <div key={d.category || `dept-${i}`}>
                    <div className="flex justify-between text-xs mb-1 gap-3">
                      <span className="text-[#111827] font-medium truncate">{d.category || 'Uncategorised'}</span>
                      <span className="text-slate-500 tabular-nums shrink-0">{d.count}</span>
                    </div>
                    <div className="h-2 bg-blue-50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((d.count / maxDept) * 100)}%`,
                          backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Card>

        <Card className="p-5">
          <SectionHeader
            title="Daily Checklist Status"
            subtitle="Opening and closing checklist completion."
            action={
              <Link
                to="/checklist"
                className="text-xs text-[#0A3D91] hover:underline font-medium flex items-center gap-1"
              >
                View checklist
                <Icon name="arrow-right" className="w-3 h-3" />
              </Link>
            }
          />
          {loading || !checklistStats ? (
            <div className="space-y-3 mt-4">
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4 mt-5">
              {[
                { label: 'Opening', data: checklistStats.opening, color: '#f59e0b' },
                { label: 'Closing', data: checklistStats.closing, color: '#6366f1' },
              ].map(({ label, data, color }) => {
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
                const done = pct === 100
                return (
                  <div key={label} className="rounded-xl border border-[#D1DCF0] bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm text-[#111827] font-semibold">{label}</span>
                      <span className="text-xs tabular-nums font-semibold" style={{ color: done ? '#10b981' : color }}>
                        {data.completed}/{data.total} complete
                      </span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: done ? '#10b981' : color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
