import { useState, useEffect, useCallback } from 'react'
import {
  getStaffPerformanceReport, getDepartmentReport, getDailyReport,
  getPriorityReport, getStaff, getTasks,
} from '../services/api'
import { useAuth } from '../context/AuthContext'

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function pctColor(pct) {
  if (pct >= 80) return '#10b981'
  if (pct >= 50) return '#f59e0b'
  return '#ef4444'
}

function MiniBar({ pct, color }) {
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

const DEPT_ICONS = {
  Sales: '🛒', Purchase: '📦', 'Stock Audit': '🔍', RGHS: '🏥',
  'Customer Support': '💬', Delivery: '🚚', Billing: '💳',
  'Expiry Return': '⏰', Admin: '📋', Cleaning: '🧹',
  'Cleaning / Store Maintenance': '🧹',
}

// ── Tab 1: Staff Performance ─────────────────────────────────────────────────

function StaffPerformance({ data, staffList }) {
  const staffMap = {}
  staffList.forEach((s) => { staffMap[s.id] = s })

  const totals = data.reduce(
    (acc, r) => ({
      assigned: acc.assigned + (r.assigned || 0),
      completed: acc.completed + (r.completed || 0),
      delayed: acc.delayed + (r.delayed || 0),
    }),
    { assigned: 0, completed: 0, delayed: 0 }
  )
  const totalPct = totals.assigned > 0
    ? Math.round((totals.completed / totals.assigned) * 100)
    : 0

  if (data.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">No task assignment data yet.</p>
  }

  return (
    <div className="space-y-3">
      {data.map((r) => {
        const s = staffMap[r.assigned_to]
        const name  = s?.name  ?? `Staff #${r.assigned_to}`
        const role  = s?.role  ?? ''
        const color = s?.color ?? '#64748b'
        const pct   = r.completion_pct ?? 0
        const color2 = pctColor(pct)

        return (
          <div key={r.assigned_to} className="bg-white rounded-xl p-4 border border-[#D1DCF0] flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: color + '22', border: `2px solid ${color}55`, color }}
            >
              {initials(name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[#111827] text-sm font-semibold truncate">{name}</p>
                <span className="text-xs font-bold tabular-nums ml-2 shrink-0" style={{ color: color2 }}>{pct}%</span>
              </div>
              {role && <p className="text-slate-400 text-[10px] mb-1">{role}</p>}
              <MiniBar pct={pct} color={color2} />
            </div>
            <div className="hidden sm:flex gap-4 shrink-0 text-center">
              <div>
                <p className="text-[#111827] text-base font-bold tabular-nums">{r.assigned ?? 0}</p>
                <p className="text-slate-400 text-[10px]">Assigned</p>
              </div>
              <div>
                <p className="text-emerald-600 text-base font-bold tabular-nums">{r.completed ?? 0}</p>
                <p className="text-slate-400 text-[10px]">Done</p>
              </div>
              <div>
                <p className="text-red-500 text-base font-bold tabular-nums">{r.delayed ?? 0}</p>
                <p className="text-slate-400 text-[10px]">Delayed</p>
              </div>
            </div>
          </div>
        )
      })}

      {/* Summary row */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[#0A3D91] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#0A3D91] text-sm font-bold">All Staff</p>
          <MiniBar pct={totalPct} color={pctColor(totalPct)} />
        </div>
        <div className="hidden sm:flex gap-4 shrink-0 text-center">
          <div>
            <p className="text-[#111827] text-base font-bold tabular-nums">{totals.assigned}</p>
            <p className="text-slate-400 text-[10px]">Total</p>
          </div>
          <div>
            <p className="text-emerald-600 text-base font-bold tabular-nums">{totals.completed}</p>
            <p className="text-slate-400 text-[10px]">Done</p>
          </div>
          <div>
            <p className="text-red-500 text-base font-bold tabular-nums">{totals.delayed}</p>
            <p className="text-slate-400 text-[10px]">Delayed</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: Department Summary ────────────────────────────────────────────────

function DepartmentSummary({ data }) {
  if (data.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">No department data yet.</p>
  }

  const max = Math.max(...data.map((d) => d.total), 1)

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
        return (
          <div key={d.category} className="bg-white rounded-xl p-4 border border-[#D1DCF0]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{DEPT_ICONS[d.category] ?? '📁'}</span>
                <p className="text-[#111827] text-sm font-semibold">{d.category || 'Uncategorised'}</p>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: pctColor(pct) }}>{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round((d.total / max) * 100)}%`, backgroundColor: pctColor(pct) }}
              />
            </div>
            <div className="flex gap-3 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{d.total} total</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{d.completed ?? 0} done</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{d.pending ?? 0} pending</span>
              {(d.delayed ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{d.delayed} delayed</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab 3: Daily Report ──────────────────────────────────────────────────────

function DailyReport({ data }) {
  if (!data) return <p className="text-slate-400 text-sm text-center py-12">Loading…</p>

  const { tasks, checklist, date } = data
  const openingPct = checklist.opening.total > 0
    ? Math.round((checklist.opening.completed / checklist.opening.total) * 100) : 0
  const closingPct = checklist.closing.total > 0
    ? Math.round((checklist.closing.completed / checklist.closing.total) * 100) : 0

  const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  function Stat({ label, value, color }) {
    return (
      <div className="bg-white rounded-xl p-4 border border-[#D1DCF0] text-center">
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value ?? 0}</p>
        <p className="text-slate-500 text-xs mt-0.5">{label}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">{dateStr}</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1DCF0] text-slate-600 text-xs hover:border-[#0A3D91]/40 hover:text-[#0A3D91] transition-colors print:hidden"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Completed" value={tasks.completed} color="#10b981" />
        <Stat label="Pending"   value={tasks.pending}   color="#f59e0b" />
        <Stat label="Delayed"   value={tasks.delayed}   color="#ef4444" />
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#D1DCF0] space-y-4">
        <p className="text-[#111827] font-semibold text-sm">Checklist Status</p>
        {[
          { label: '🌅 Opening', data: checklist.opening, pct: openingPct, color: '#f59e0b' },
          { label: '🌙 Closing',  data: checklist.closing, pct: closingPct, color: '#6366f1' },
        ].map(({ label, data: cl, pct, color }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">{label}</span>
              <span className="font-bold tabular-nums" style={{ color: pct === 100 ? '#10b981' : color }}>
                {cl.completed}/{cl.total} ({pct}%)
              </span>
            </div>
            <MiniBar pct={pct} color={pct === 100 ? '#10b981' : color} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#D1DCF0]">
        <p className="text-[#111827] font-semibold text-sm mb-2">Total Tasks Today</p>
        <p className="text-3xl font-bold text-[#0A3D91] tabular-nums">{tasks.total ?? 0}</p>
      </div>
    </div>
  )
}

// ── Tab 4: Priority Analysis ─────────────────────────────────────────────────

function PriorityAnalysis({ data, criticalHighTasks, staffList }) {
  const staffMap = {}
  staffList.forEach((s) => { staffMap[s.id] = s })

  const PRIORITY_CFG = {
    critical: { label: 'Critical', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600'    },
    high:     { label: 'High',     bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-600' },
    medium:   { label: 'Medium',   bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-600'   },
    low:      { label: 'Low',      bg: 'bg-slate-100',  border: 'border-slate-200',   text: 'text-slate-500'  },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {['critical','high','medium','low'].map((p) => {
          const row = data.find((r) => r.priority === p) ?? { pending: 0, completed: 0, in_progress: 0, total: 0 }
          const cfg = PRIORITY_CFG[p]
          return (
            <div key={p} className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border}`}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${cfg.text}`}>{cfg.label}</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-amber-600 text-xl font-bold tabular-nums">{row.pending ?? 0}</p>
                  <p className="text-slate-400 text-[10px]">Pending</p>
                </div>
                <div>
                  <p className="text-emerald-600 text-xl font-bold tabular-nums">{row.completed ?? 0}</p>
                  <p className="text-slate-400 text-[10px]">Done</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {criticalHighTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D1DCF0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0F4FF] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <p className="text-[#111827] text-sm font-semibold">Critical &amp; High Pending</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 ml-auto">
              {criticalHighTasks.length}
            </span>
          </div>
          <div className="divide-y divide-[#F0F4FF]">
            {criticalHighTasks.slice(0, 20).map((t) => {
              const assignee = staffMap[t.assigned_to]
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.priority === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
                  <p className="flex-1 text-[#111827] text-xs font-medium truncate">{t.title}</p>
                  {assignee && (
                    <span className="text-slate-400 text-[10px] shrink-0">{assignee.name}</span>
                  )}
                  {t.due_date && (
                    <span className="text-red-400 text-[10px] shrink-0">{t.due_date}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Reports Page ────────────────────────────────────────────────────────

const TABS = [
  { key: 'staff',    label: 'Staff Performance' },
  { key: 'dept',     label: 'Department' },
  { key: 'daily',    label: 'Daily Report' },
  { key: 'priority', label: 'Priority' },
]

export default function Reports() {
  const { user } = useAuth()
  const [tab, setTab] = useState('staff')
  const [loading, setLoading] = useState(true)

  const [staffPerf, setStaffPerf]     = useState([])
  const [deptData, setDeptData]       = useState([])
  const [dailyData, setDailyData]     = useState(null)
  const [priorityData, setPriorityData] = useState([])
  const [staffList, setStaffList]     = useState([])
  const [critHighTasks, setCritHighTasks] = useState([])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [perf, dept, daily, priority, staff, crit, high] = await Promise.all([
        getStaffPerformanceReport(),
        getDepartmentReport(),
        getDailyReport(),
        getPriorityReport(),
        getStaff(),
        getTasks({ priority: 'critical', status: 'pending' }),
        getTasks({ priority: 'high',     status: 'pending' }),
      ])
      setStaffPerf(perf)
      setDeptData(dept)
      setDailyData(daily)
      setPriorityData(priority)
      setStaffList(staff)
      setCritHighTasks([...crit, ...high])
    } catch { /* retain previous */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-[#111827] font-semibold">Access Restricted</p>
        <p className="text-slate-500 text-sm">Reports are only accessible to Administrators.</p>
      </div>
    )
  }

  function exportJSON() {
    const payload = {
      exported_at: new Date().toISOString(),
      staff_performance: staffPerf,
      department_summary: deptData,
      daily_report: dailyData,
      priority_analysis: priorityData,
    }
    downloadFile(JSON.stringify(payload, null, 2), 'anjani-report.json', 'application/json')
  }

  function exportCSV() {
    const staffMap = {}
    staffList.forEach((s) => { staffMap[s.id] = s })

    const rows = [['Name', 'Role', 'Assigned', 'Completed', 'Delayed', 'Completion %']]
    staffPerf.forEach((r) => {
      const s = staffMap[r.assigned_to] ?? {}
      rows.push([
        s.name ?? `Staff #${r.assigned_to}`,
        s.role ?? '',
        r.assigned ?? 0,
        r.completed ?? 0,
        r.delayed ?? 0,
        r.completion_pct ?? 0,
      ])
    })
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadFile(csv, 'anjani-report.csv', 'text/csv')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] tracking-tight mb-1">Reports</h2>
          <p className="text-slate-500 text-sm">Analytics and operational summaries.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D1DCF0] text-slate-600 text-xs font-medium hover:border-[#0A3D91]/40 hover:text-[#0A3D91] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A3D91] text-white text-xs font-semibold hover:bg-[#0057D9] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl p-1 border border-[#D1DCF0] mb-5 gap-1 overflow-x-auto print:hidden">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex-1 min-w-fit py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              tab === key
                ? 'bg-[#0A3D91] text-white shadow-sm'
                : 'text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-white border border-[#D1DCF0] animate-pulse" />)}
        </div>
      ) : (
        <>
          {tab === 'staff'    && <StaffPerformance data={staffPerf} staffList={staffList} />}
          {tab === 'dept'     && <DepartmentSummary data={deptData} />}
          {tab === 'daily'    && <DailyReport data={dailyData} />}
          {tab === 'priority' && <PriorityAnalysis data={priorityData} criticalHighTasks={critHighTasks} staffList={staffList} />}
        </>
      )}
    </div>
  )
}
