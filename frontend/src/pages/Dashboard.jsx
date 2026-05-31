import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getTodayTasks, getTaskStats, getStaff, getTasks, updateTaskStatus, getChecklistStats } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'
import { generateTaskNotifications } from '../utils/notificationGenerator'

const PRIORITY_BORDER = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#475569',
}

const PRIORITY_DOT = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#475569',
}

const STATUS_CFG = {
  pending:     { label: 'Pending',     cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  delayed:     { label: 'Delayed',     cls: 'bg-red-50 text-red-600 border border-red-200' },
}

const DEPT_COLORS = [
  '#14b8a6','#8b5cf6','#f59e0b','#3b82f6','#ef4444',
  '#ec4899','#10b981','#f97316','#6366f1','#06b6d4',
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function StatCard({ label, value, color, icon, loading }) {
  const palette = {
    teal:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'text-[#0A3D91]', val: 'text-[#0A3D91]' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', val: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: 'text-amber-600',   val: 'text-amber-600' },
    red:     { bg: 'bg-red-50',     border: 'border-red-100',     icon: 'text-red-500',     val: 'text-red-500' },
  }[color]

  return (
    <div className="bg-white rounded-2xl p-5 flex items-center gap-4 border border-[#D1DCF0] shadow-sm">
      <div className={`w-11 h-11 rounded-xl ${palette.bg} border ${palette.border} flex items-center justify-center shrink-0`}>
        <span className={palette.icon}>{icon}</span>
      </div>
      <div>
        {loading
          ? <div className="h-7 w-12 bg-slate-100 rounded animate-pulse mb-1" />
          : <p className={`text-2xl font-bold tabular-nums ${palette.val}`}>{value}</p>
        }
        <p className="text-slate-500 text-xs font-medium">{label}</p>
      </div>
    </div>
  )
}

function TodayTaskItem({ task, staffList, onComplete, completing }) {
  const st = STATUS_CFG[task.status] || STATUS_CFG.pending
  const assignee = staffList.find((s) => String(s.id) === String(task.assigned_to))
  const borderColor = PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.low

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#D1DCF0] hover:bg-blue-50/50 transition-colors"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-[#111827]'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {assignee && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: assignee.color + '22', color: assignee.color, border: `1px solid ${assignee.color}44` }}
            >
              {assignee.name}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
        </div>
      </div>
      {task.status !== 'completed' && (
        <button
          onClick={() => onComplete(task.id)}
          disabled={completing === task.id}
          className="shrink-0 w-7 h-7 rounded-lg bg-[#0A3D91] flex items-center justify-center text-white hover:bg-[#0057D9] transition-colors disabled:opacity-50"
          title="Mark complete"
        >
          {completing === task.id
            ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
          }
        </button>
      )}
    </div>
  )
}

const ROLE_BADGE = {
  admin:   { label: 'Admin',   cls: 'bg-[#0A3D91] text-white border-transparent' },
  manager: { label: 'Manager', cls: 'bg-teal-600 text-white border-transparent' },
  staff:   { label: 'Staff',   cls: 'bg-slate-500 text-white border-transparent' },
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  const [todayTasks, setTodayTasks]       = useState([])
  const [stats, setStats]                 = useState(null)
  const [staffList, setStaffList]         = useState([])
  const [criticalTasks, setCriticalTasks] = useState([])
  const [allTasks, setAllTasks]           = useState([])
  const [checklistStats, setChecklistStats] = useState(null)
  const [loading, setLoading]             = useState(true)
  const [completing, setCompleting]       = useState(null)

  const [calDate, setCalDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const load = useCallback(async () => {
    try {
      const [todayData, statsData, staffData, critData, allData, clStats] = await Promise.all([
        getTodayTasks(),
        getTaskStats(),
        getStaff(),
        getTasks({ priority: 'critical', status: 'pending' }),
        getTasks(),
        getChecklistStats(),
      ])
      setTodayTasks(todayData)
      setStats(statsData)
      setStaffList(staffData)
      setCriticalTasks(critData)
      setAllTasks(allData)
      setChecklistStats(clStats)
      generateTaskNotifications(todayData)
    } catch {
      // silently retain previous data on background refresh
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

  // ── For staff role: scope to their own tasks ──────────────────────────────
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

  // ── Stat card values ──────────────────────────────────────────────────────
  const todayTotal     = visibleTodayTasks.length
  const todayCompleted = visibleTodayTasks.filter((t) => t.status === 'completed').length
  const todayPending   = visibleTodayTasks.filter((t) => t.status === 'pending').length
  const todayDelayed   = user?.role === 'staff'
    ? visibleTodayTasks.filter((t) => t.status === 'delayed').length
    : stats?.delayed ?? 0

  // ── Staff progress (today's tasks) ───────────────────────────────────────
  const staffProgress = useMemo(() => staffList.map((s) => {
    const mine = todayTasks.filter((t) => String(t.assigned_to) === String(s.id))
    return { ...s, total: mine.length, completed: mine.filter((t) => t.status === 'completed').length }
  }), [staffList, todayTasks])

  // ── Department chart ──────────────────────────────────────────────────────
  const deptData   = stats?.by_category ?? []
  const maxDept    = Math.max(...deptData.map((d) => d.count), 1)

  // ── Mini calendar ─────────────────────────────────────────────────────────
  const { year, month } = calDate
  const todayStr   = new Date().toISOString().slice(0, 10)
  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMon  = new Date(year, month + 1, 0).getDate()

  const tasksByDate = useMemo(() => allTasks.reduce((acc, t) => {
    if (t.due_date) {
      acc[t.due_date] = acc[t.due_date] ? [...acc[t.due_date], t] : [t]
    }
    return acc
  }, {}), [allTasks])

  const calCells = []
  for (let i = 0; i < firstDay; i++) calCells.push(null)
  for (let d = 1; d <= daysInMon; d++) calCells.push(d)

  function prevMonth() {
    setCalDate(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })
  }
  function nextMonth() {
    setCalDate(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })
  }

  // ── Icons ──────────────────────────────────────────────────────────────────
  const CheckIcon = (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
  const ClipIcon = (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
  const ClockIcon = (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
  const WarnIcon = (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
  const ChevLeft = (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
  const ChevRight = (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )

  const badge = ROLE_BADGE[user?.role] ?? ROLE_BADGE.staff

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#111827] tracking-tight">
            Good {greeting()}, {user?.name ?? 'there'}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Here's what's happening today.</p>
        </div>
        <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* ── Row 1: Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks Today" value={todayTotal}     color="teal"    icon={ClipIcon}  loading={loading} />
        <StatCard label="Completed"          value={todayCompleted} color="emerald" icon={CheckIcon} loading={loading} />
        <StatCard label="Pending"            value={todayPending}   color="amber"   icon={ClockIcon} loading={loading} />
        <StatCard label="Delayed"            value={todayDelayed}   color="red"     icon={WarnIcon}  loading={loading} />
      </div>

      {/* ── Checklist Summary Card ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-[#D1DCF0] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#111827] font-semibold">Today's Checklist Status</h3>
          <Link
            to="/checklist"
            className="text-xs text-[#0A3D91] hover:underline font-medium flex items-center gap-1"
          >
            View Full Checklist
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {loading || !checklistStats ? (
          <div className="space-y-3">
            <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { label: 'Opening', emoji: '🌅', data: checklistStats.opening, color: '#f59e0b' },
              { label: 'Closing', emoji: '🌙', data: checklistStats.closing, color: '#6366f1' },
            ].map(({ label, emoji, data, color }) => {
              const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
              const done = pct === 100
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-slate-600 font-medium flex items-center gap-1.5">
                      <span>{emoji}</span> {label}
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: done ? '#10b981' : color }}>
                      {data.completed}/{data.total}
                      {done && <span className="ml-1">✓</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
      </div>

      {/* ── Row 2: Today's Tasks + Staff Progress ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Today's Tasks */}
        <div className={`${user?.role === 'staff' ? 'lg:col-span-5' : 'lg:col-span-3'} bg-white rounded-2xl p-5 border border-[#D1DCF0] shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#111827] font-semibold">Today's Tasks</h3>
            {visibleTodayTasks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#0A3D91] border border-blue-200">
                {visibleTodayTasks.length}
              </span>
            )}
          </div>
          <div className="overflow-y-auto max-h-80 space-y-2 pr-1 scrollbar-thin">
            {loading
              ? [1,2,3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                ))
              : visibleTodayTasks.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                  </svg>
                  <p className="text-slate-500 text-sm">No tasks scheduled for today</p>
                </div>
              )
              : visibleTodayTasks.map((t) => (
                <TodayTaskItem
                  key={t.id}
                  task={t}
                  staffList={staffList}
                  onComplete={quickComplete}
                  completing={completing}
                />
              ))
            }
          </div>
        </div>

        {/* Staff Progress — hidden for staff role */}
        {user?.role !== 'staff' && (
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#D1DCF0] shadow-sm">
          <h3 className="text-[#111827] font-semibold mb-4">Staff Progress</h3>
          <div className="space-y-4 overflow-y-auto max-h-80">
            {loading
              ? [1,2,3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ))
              : staffProgress.map((s) => {
                  const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
                  return (
                    <div key={s.id}>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ background: (s.color || '#3b82f6') + '22', border: `1.5px solid ${s.color || '#3b82f6'}55`, color: s.color || '#3b82f6' }}
                        >
                          {initials(s.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#111827] text-xs font-medium truncate">{s.name}</p>
                          {s.role && <p className="text-slate-500 text-[10px] truncate">{s.role}</p>}
                        </div>
                        <span className="text-slate-500 text-[10px] tabular-nums shrink-0">
                          {s.total === 0 ? '0 tasks' : `${s.completed}/${s.total}`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden ml-9">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: s.color || '#3b82f6' }}
                        />
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </div>
        )}
      </div>

      {/* ── Row 3: Department Summary + Critical Tasks ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Department Summary */}
        <div className="bg-white rounded-2xl p-5 border border-[#D1DCF0] shadow-sm">
          <h3 className="text-[#111827] font-semibold mb-4">Department Summary</h3>
          {loading
            ? [1,2,3,4].map((i) => <div key={i} className="h-6 rounded bg-slate-100 animate-pulse mb-3" />)
            : deptData.length === 0
            ? <p className="text-slate-500 text-sm text-center py-8">No category data yet</p>
            : (
              <div className="space-y-3">
                {deptData.map((d, i) => (
                  <div key={d.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#111827] font-medium truncate">{d.category || 'Uncategorised'}</span>
                      <span className="text-slate-500 tabular-nums ml-2 shrink-0">{d.count}</span>
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
        </div>

        {/* Critical Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-[#D1DCF0] shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-[#111827] font-semibold">Critical Tasks</h3>
            {criticalTasks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                {criticalTasks.length}
              </span>
            )}
          </div>
          {loading
            ? [1,2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse mb-2" />)
            : criticalTasks.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-500/30" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-slate-500 text-sm">No critical tasks pending</p>
              </div>
            )
            : (
              <div className="space-y-2.5 overflow-y-auto max-h-60">
                {criticalTasks.map((t) => {
                  const assignee = staffList.find((s) => String(s.id) === String(t.assigned_to))
                  return (
                    <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#111827] text-sm font-medium truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {t.due_date && (
                            <span className="text-red-500 text-[10px]">{t.due_date}</span>
                          )}
                          {t.due_time && (
                            <span className="text-red-500 text-[10px]">{t.due_time}</span>
                          )}
                          {assignee && (
                            <span className="text-slate-500 text-[10px]">· {assignee.name}</span>
                          )}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 shrink-0">
                        Critical
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Row 4: Mini Calendar ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-[#D1DCF0] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#111827] font-semibold">Calendar</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#0A3D91] transition-colors"
            >
              {ChevLeft}
            </button>
            <span className="text-[#111827] text-sm font-medium w-32 text-center">
              {MONTHS[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#0A3D91] transition-colors"
            >
              {ChevRight}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
            <div key={d} className="text-center text-slate-400 text-[10px] font-semibold py-1">{d}</div>
          ))}
          {calCells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const pad   = (n) => String(n).padStart(2, '0')
            const ds    = `${year}-${pad(month + 1)}-${pad(day)}`
            const isToday  = ds === todayStr
            const dayTasks = tasksByDate[ds] ?? []
            const dotColors = [...new Set(dayTasks.map((t) => PRIORITY_DOT[t.priority] || PRIORITY_DOT.low))]

            return (
              <button
                key={ds}
                onClick={() => navigate(`/tasks?date=${ds}`)}
                className={[
                  'relative flex flex-col items-center py-1.5 rounded-lg transition-colors text-xs font-medium',
                  isToday
                    ? 'bg-[#0A3D91] text-white'
                    : dayTasks.length
                    ? 'hover:bg-blue-50 text-[#111827]'
                    : 'hover:bg-slate-50 text-slate-400',
                ].join(' ')}
              >
                {day}
                {dayTasks.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dotColors.slice(0, 3).map((c, ci) => (
                      <div
                        key={ci}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isToday ? 'rgba(255,255,255,0.7)' : c }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <p className="text-slate-400 text-[10px] text-center mt-3">
          Click a date to view its tasks
        </p>
      </div>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
