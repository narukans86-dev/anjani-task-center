import { useState, useEffect, useCallback, useMemo } from 'react'
import { getTasks, getStaff, updateTaskStatus } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

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
  pending:     { label: 'Pending',     cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  delayed:     { label: 'Delayed',     cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function pad(n) { return String(n).padStart(2, '0') }
function todayStr() { return new Date().toISOString().slice(0, 10) }

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function TaskListItem({ task, staffList, onComplete, completing }) {
  const st = STATUS_CFG[task.status] || STATUS_CFG.pending
  const assignee = staffList.find((s) => String(s.id) === String(task.assigned_to))
  const borderColor = PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.low

  return (
    <div
      className="p-3 rounded-xl bg-white border border-[#D1DCF0] hover:bg-blue-50/50 transition-colors"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-[#111827]'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
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
            <p className="text-slate-500 text-[10px] mt-0.5">{task.due_time}</p>
          )}
        </div>
        {task.status !== 'completed' && (
          <button
            onClick={() => onComplete(task.id)}
            disabled={completing === task.id}
            className="shrink-0 w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 hover:bg-teal-500/20 transition-colors disabled:opacity-50"
            title="Mark complete"
          >
            {completing === task.id
              ? <div className="w-2.5 h-2.5 border border-teal-400/40 border-t-teal-400 rounded-full animate-spin" />
              : <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
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

  const tasksByDate = useMemo(() => allTasks.reduce((acc, t) => {
    if (t.due_date) {
      acc[t.due_date] = acc[t.due_date] ? [...acc[t.due_date], t] : [t]
    }
    return acc
  }, {}), [allTasks])

  const selectedTasks = tasksByDate[selectedDate] ?? []

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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Calendar</h2>
          <p className="text-slate-400 text-sm">Click a date to view and manage its tasks.</p>
        </div>
        <button
          onClick={goToday}
          className="px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-400 text-sm hover:bg-teal-500/10 transition-colors"
        >
          Today
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Calendar Grid ─────────────────────────────────────────────── */}
        <div className="flex-1 card-glass rounded-2xl p-5">
          {/* Month header */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#0A3D91] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-white font-semibold text-base">
              {MONTHS[month]} {year}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#0A3D91] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="text-center text-slate-600 text-[10px] font-semibold py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="aspect-square" />

              const ds        = `${year}-${pad(month + 1)}-${pad(day)}`
              const isToday   = ds === today
              const isSel     = ds === selectedDate
              const dayTasks  = tasksByDate[ds] ?? []
              const hasTasks  = dayTasks.length > 0
              const dotColors = [...new Set(dayTasks.map((t) => PRIORITY_DOT[t.priority] || PRIORITY_DOT.low))]

              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  className={[
                    'relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl transition-all aspect-square text-xs font-medium',
                    isToday  ? 'bg-teal-500 text-white ring-2 ring-teal-400/50' :
                    isSel    ? 'bg-slate-700 text-white ring-2 ring-slate-500/50' :
                    hasTasks ? 'hover:bg-blue-50 text-[#374151]' :
                               'hover:bg-blue-50/50 text-slate-400',
                  ].join(' ')}
                >
                  <span>{day}</span>
                  {hasTasks && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dotColors.slice(0, 3).map((c, ci) => (
                        <div
                          key={ci}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: isToday || isSel ? 'rgba(255,255,255,0.7)' : c }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800/60 flex-wrap">
            {Object.entries(PRIORITY_DOT).map(([p, c]) => (
              <div key={p} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-slate-500 text-[10px] capitalize">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Side Panel ────────────────────────────────────────────────── */}
        <div className="lg:w-80 xl:w-96 card-glass rounded-2xl p-5 flex flex-col">
          <div className="mb-4">
            {selectedDate
              ? (
                <>
                  <p className="text-white font-semibold text-sm">{selDateLabel}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {selectedTasks.length === 0
                      ? 'No tasks'
                      : `${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </>
              )
              : <p className="text-slate-400 text-sm">Select a date</p>
            }
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[520px] pr-0.5">
            {loading
              ? [1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)
              : selectedTasks.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <p className="text-slate-500 text-sm">No tasks on this date</p>
                  <p className="text-slate-600 text-xs">Add tasks with this due date from the Tasks page</p>
                </div>
              )
              : selectedTasks.map((t) => (
                <TaskListItem
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
      </div>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
