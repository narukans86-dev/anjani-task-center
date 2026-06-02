import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { getEffectiveRole } from '../services/permissions'

// ── API helper ────────────────────────────────────────────────────────────

function getAuthToken() {
  try {
    const raw = localStorage.getItem('anjani_user')
    return raw ? (JSON.parse(raw)?.token ?? null) : null
  } catch { return null }
}

async function apiFetch(path, options = {}) {
  const token = getAuthToken()
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Config ────────────────────────────────────────────────────────────────

const PRIORITY_CLS = {
  critical: 'bg-red-50 text-red-700 border border-red-200',
  high:     'bg-orange-50 text-orange-700 border border-orange-200',
  medium:   'bg-blue-50 text-blue-700 border border-blue-200',
  low:      'bg-slate-100 text-slate-500 border border-slate-200',
}

const WORKFLOW_LABEL = {
  upcoming:             'Upcoming',
  stock_check_pending:  'Stock Check',
  reorder_required:     'Reorder Required',
  reorder_placed:       'Reorder Placed',
  stock_available:      'Stock Available',
  patient_call_pending: 'Call Pending',
  patient_confirmed:    'Confirmed',
  dispatch_pending:     'Dispatch Pending',
  dispatched:           'Dispatched',
  delivered:            'Delivered',
  cancelled:            'Cancelled',
}

const DELIVERY_LABEL = {
  pickup: 'Pickup',
  home_delivery: 'Home Delivery',
  courier: 'Courier',
  online: 'Online',
}

// ── CSV export ────────────────────────────────────────────────────────────

function exportCSV(rows, filename) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const lines = [
    keys.join(','),
    ...rows.map((r) =>
      keys.map((k) => {
        const v = r[k] ?? ''
        return String(v).includes(',') || String(v).includes('"')
          ? `"${String(v).replace(/"/g, '""')}"`
          : String(v)
      }).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function exportJSON(rows, filename) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Stat widget ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col gap-2 p-4 rounded-xl border text-left w-full transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
        color,
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <span className="text-3xl font-bold">{value ?? 0}</span>
    </button>
  )
}

// ── Quick action button ───────────────────────────────────────────────────

function QuickBtn({ label, icon, onClick, color = 'bg-white border border-[#D1DCF0] text-[#0A3D91] hover:bg-blue-50' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow-md ${color}`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

// ── Report section ────────────────────────────────────────────────────────

function ReportTable({ columns, rows, loading, emptyMsg = 'No records found.' }) {
  if (loading) return (
    <div className="py-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
      <svg className="w-4 h-4 animate-spin text-[#0A3D91]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      Loading…
    </div>
  )
  if (!rows) return <div className="py-8 text-center text-slate-400 text-sm">Click 'Run Report' to load data.</div>
  if (!rows.length) return <div className="py-8 text-center text-slate-400 text-sm">{emptyMsg}</div>
  
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 whitespace-nowrap text-slate-700">
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-[#0A3D91] text-sm">{title}</span>
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  )
}

// ── Priority badge ────────────────────────────────────────────────────────

function PriBadge({ value }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_CLS[value] ?? 'bg-slate-100 text-slate-500'}`}>
      {value ?? '—'}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────

const INITIAL_SUMMARY = {
  total: 0, dueNext7: 0, stockCheck: 0, reorderRequired: 0,
  callPending: 0, dispatchPending: 0, weekendAlerts: 0, shiprocketPending: 0,
}

export default function RefillDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, showToast, removeToast } = useToast()

  const [summary, setSummary] = useState(INITIAL_SUMMARY)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const effectiveRole = getEffectiveRole(user)
  const isAdminOrManager = effectiveRole === 'admin' || effectiveRole === 'decision_manager' || effectiveRole === 'sales_manager'

  // Report data keyed by report name
  const [reportData, setReportData] = useState({})
  const [reportLoading, setReportLoading] = useState({})

  // Report filters
  const [filters, setFilters] = useState({
    upcoming:        { days: 7,  priority: '', patientType: '', search: '' },
    missed:          { days: 30, priority: '', patientType: '', search: '' },
    reorder:         { priority: '', search: '' },
    callPending:     { priority: '', patientType: '', search: '' },
    dispatchPending: { priority: '', deliveryMode: '', search: '' },
    staffPerf:       {},
    shiprocket:      { priority: '', search: '' },
  })

  // ── Load summary ──────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const data = await apiFetch('/reports/refill-summary')
      setSummary(data || INITIAL_SUMMARY)
    } catch (err) {
      showToast('Failed to load dashboard summary: ' + err.message, 'error')
      setSummary(INITIAL_SUMMARY)
    } finally {
      setSummaryLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadSummary() }, [loadSummary])

  // ── Load report ───────────────────────────────────────────────────────

  const loadReport = useCallback(async (key) => {
    setReportLoading((p) => ({ ...p, [key]: true }))
    try {
      const f = filters[key] ?? {}
      const qs = new URLSearchParams(Object.fromEntries(
        Object.entries(f).filter(([, v]) => v !== '' && v !== undefined)
      )).toString()
      const endpoint = {
        upcoming:        '/reports/refill-upcoming',
        missed:          '/reports/refill-missed',
        reorder:         '/reports/refill-reorder',
        callPending:     '/reports/refill-call-pending',
        dispatchPending: '/reports/refill-dispatch-pending',
        staffPerf:       '/reports/refill-staff-performance',
        shiprocket:      '/reports/refill-shiprocket',
      }[key]
      const result = await apiFetch(`${endpoint}${qs ? `?${qs}` : ''}`)
      setReportData((p) => ({ ...p, [key]: result.data ?? result }))
    } catch (err) {
      showToast(`Failed to load report: ${err.message}`, 'error')
    } finally {
      setReportLoading((p) => ({ ...p, [key]: false }))
    }
  }, [filters, showToast])

  const setFilter = (key, field, value) => {
    setFilters((p) => ({ ...p, [key]: { ...p[key], [field]: value } }))
  }

  // ── Column definitions ─────────────────────────────────────────────────

  const basePatientCols = [
    { key: 'patient_name',    label: 'Patient' },
    { key: 'patient_mobile',  label: 'Mobile' },
    { key: 'next_refill_date',label: 'Refill Date' },
    { key: 'priority',        label: 'Priority', render: (r) => <PriBadge value={r.priority} /> },
    { key: 'patient_type',    label: 'Type' },
    { key: 'workflow_status', label: 'Status', render: (r) => WORKFLOW_LABEL[r.workflow_status] ?? r.workflow_status },
  ]

  const upcomingCols = [
    ...basePatientCols,
    { key: 'delivery_mode',    label: 'Delivery',  render: (r) => DELIVERY_LABEL[r.delivery_mode] ?? r.delivery_mode },
    { key: 'sales_staff_name', label: 'Sales Staff' },
  ]

  const missedCols = [
    ...basePatientCols,
    { key: 'sales_staff_name', label: 'Sales Staff' },
  ]

  const reorderCols = [
    { key: 'patient_name',          label: 'Patient' },
    { key: 'patient_mobile',        label: 'Mobile' },
    { key: 'next_refill_date',      label: 'Refill Date' },
    { key: 'priority',              label: 'Priority', render: (r) => <PriBadge value={r.priority} /> },
    { key: 'workflow_status',       label: 'Status', render: (r) => WORKFLOW_LABEL[r.workflow_status] ?? r.workflow_status },
    { key: 'purchase_staff_name',   label: 'Purchase Staff' },
    { key: 'purchase_manager_name', label: 'Purchase Manager' },
  ]

  const callCols = [
    { key: 'patient_name',    label: 'Patient' },
    { key: 'patient_mobile',  label: 'Mobile' },
    { key: 'patient_whatsapp',label: 'WhatsApp' },
    { key: 'next_refill_date',label: 'Refill Date' },
    { key: 'priority',        label: 'Priority', render: (r) => <PriBadge value={r.priority} /> },
    { key: 'patient_type',    label: 'Type' },
    { key: 'sales_staff_name',label: 'Assigned Staff' },
  ]

  const dispatchCols = [
    { key: 'patient_name',    label: 'Patient' },
    { key: 'patient_mobile',  label: 'Mobile' },
    { key: 'patient_address', label: 'Address' },
    { key: 'next_refill_date',label: 'Refill Date' },
    { key: 'priority',        label: 'Priority', render: (r) => <PriBadge value={r.priority} /> },
    { key: 'delivery_mode',   label: 'Delivery',  render: (r) => DELIVERY_LABEL[r.delivery_mode] ?? r.delivery_mode },
    { key: 'sales_staff_name',label: 'Sales Staff' },
  ]

  const staffPerfCols = [
    { key: 'staff_name',    label: 'Staff' },
    { key: 'department',    label: 'Department' },
    { key: 'total_assigned',label: 'Total' },
    { key: 'delivered',     label: 'Delivered' },
    { key: 'dispatched',    label: 'Dispatched' },
    { key: 'in_progress',   label: 'In Progress' },
    { key: 'overdue',       label: 'Overdue', render: (r) => (
      <span className={r.overdue > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>{r.overdue}</span>
    )},
    { key: 'cancelled',     label: 'Cancelled' },
  ]

  // ── Filter bar helper ─────────────────────────────────────────────────

  function FilterInput({ reportKey, field, placeholder, type = 'text', children }) {
    if (children) {
      return (
        <select
          value={filters[reportKey]?.[field] ?? ''}
          onChange={(e) => setFilter(reportKey, field, e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {children}
        </select>
      )
    }
    return (
      <input
        type={type}
        placeholder={placeholder}
        value={filters[reportKey]?.[field] ?? ''}
        onChange={(e) => setFilter(reportKey, field, e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[120px]"
      />
    )
  }

  function ExportBar({ reportKey, filename }) {
    const rows = reportData[reportKey]
    const loading = reportLoading[reportKey]
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => loadReport(reportKey)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-[#0A3D91] text-white text-xs font-semibold hover:bg-blue-800 transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {loading && (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          {loading ? 'Loading…' : 'Run Report'}
        </button>
        {rows?.length > 0 && (
          <>
            <button
              onClick={() => exportCSV(rows, `${filename}.csv`)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportJSON(rows, `${filename}.json`)}
              className="px-3 py-1.5 rounded-lg bg-slate-600 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Print
            </button>
            <span className="text-xs text-slate-400 ml-auto">{rows.length} records</span>
          </>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────

  const S = summary || INITIAL_SUMMARY

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto print:p-0">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0A3D91]">Refill Command Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Live overview of patient refill workflows</p>
        </div>
        <button
          onClick={loadSummary}
          disabled={summaryLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Dashboard Stat Widgets ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active Schedules"
          value={S.total}
          color="bg-blue-50 border-blue-200 text-blue-800"
          icon="📋"
          onClick={() => navigate('/patient-refill')}
        />
        <StatCard
          label="Due Next 7 Days"
          value={S.dueNext7}
          color="bg-amber-50 border-amber-200 text-amber-800"
          icon="📅"
          onClick={() => {
            setFilter('upcoming', 'days', 7)
            loadReport('upcoming')
          }}
        />
        <StatCard
          label="Stock Check Pending"
          value={S.stockCheck}
          color="bg-yellow-50 border-yellow-200 text-yellow-800"
          icon="🔍"
          onClick={() => navigate('/patient-refill?workflow=stock_check_pending')}
        />
        <StatCard
          label="Reorder Required"
          value={S.reorderRequired}
          color="bg-orange-50 border-orange-200 text-orange-800"
          icon="📦"
          onClick={() => loadReport('reorder')}
        />
        <StatCard
          label="Patient Call Pending"
          value={S.callPending}
          color="bg-purple-50 border-purple-200 text-purple-800"
          icon="📞"
          onClick={() => loadReport('callPending')}
        />
        <StatCard
          label="Dispatch Pending"
          value={S.dispatchPending}
          color="bg-indigo-50 border-indigo-200 text-indigo-800"
          icon="🚚"
          onClick={() => loadReport('dispatchPending')}
        />
        <StatCard
          label="Weekend Alerts"
          value={S.weekendAlerts}
          color="bg-rose-50 border-rose-200 text-rose-800"
          icon="⚠️"
          onClick={() => {
            setFilter('upcoming', 'days', 14)
            loadReport('upcoming')
          }}
        />
        <StatCard
          label="Shiprocket Pending"
          value={S.shiprocketPending}
          color="bg-cyan-50 border-cyan-200 text-cyan-800"
          icon="🛒"
          onClick={() => loadReport('shiprocket')}
        />
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 print:hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {isAdminOrManager && (
            <QuickBtn
              label="Add Patient Schedule"
              icon="➕"
              color="bg-[#0A3D91] text-white hover:bg-blue-800"
              onClick={() => navigate('/patient-refill')}
            />
          )}
          <QuickBtn
            label="View Refill Calendar"
            icon="📆"
            onClick={() => navigate('/calendar')}
          />
          <QuickBtn
            label="Check Reorder Tasks"
            icon="📦"
            onClick={() => loadReport('reorder')}
          />
          <QuickBtn
            label="Patient Call List"
            icon="📞"
            onClick={() => loadReport('callPending')}
          />
        </div>
      </div>

      {/* ── Reports ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-700">Reports</h2>

        {/* 1. Upcoming Refills */}
        <Section title="1. Upcoming Refill Report">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <FilterInput reportKey="upcoming" field="days" type="number" placeholder="Days" />
            <FilterInput reportKey="upcoming" field="search" placeholder="Patient name…" />
            <FilterInput reportKey="upcoming" field="priority">
              <option value="">All Priorities</option>
              {['critical','high','medium','low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterInput>
            <FilterInput reportKey="upcoming" field="patientType">
              <option value="">All Types</option>
              {['regular','chronic','critical','new'].map((t) => <option key={t} value={t}>{t}</option>)}
            </FilterInput>
            <ExportBar reportKey="upcoming" filename="refill-upcoming" />
          </div>
          <ReportTable 
            columns={upcomingCols} 
            rows={reportData.upcoming} 
            loading={reportLoading.upcoming}
            emptyMsg="Run report to see upcoming refills." 
          />
        </Section>

        {/* 2. Missed Refill Workflow */}
        <Section title="2. Missed Refill Workflow Report">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <FilterInput reportKey="missed" field="days" type="number" placeholder="Last N days" />
            <FilterInput reportKey="missed" field="search" placeholder="Patient name…" />
            <FilterInput reportKey="missed" field="priority">
              <option value="">All Priorities</option>
              {['critical','high','medium','low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterInput>
            <FilterInput reportKey="missed" field="patientType">
              <option value="">All Types</option>
              {['regular','chronic','critical','new'].map((t) => <option key={t} value={t}>{t}</option>)}
            </FilterInput>
            <ExportBar reportKey="missed" filename="refill-missed" />
          </div>
          <ReportTable 
            columns={missedCols} 
            rows={reportData.missed} 
            loading={reportLoading.missed}
            emptyMsg="Run report to see missed refills." 
          />
        </Section>

        {/* 3. Reorder Required */}
        <Section title="3. Reorder Required Report">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <FilterInput reportKey="reorder" field="search" placeholder="Patient name…" />
            <FilterInput reportKey="reorder" field="priority">
              <option value="">All Priorities</option>
              {['critical','high','medium','low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterInput>
            <ExportBar reportKey="reorder" filename="refill-reorder" />
          </div>
          <ReportTable 
            columns={reorderCols} 
            rows={reportData.reorder} 
            loading={reportLoading.reorder}
            emptyMsg="Run report to see reorder items." 
          />
        </Section>

        {/* 4. Patient Call Pending */}
        <Section title="4. Patient Call Pending Report">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <FilterInput reportKey="callPending" field="search" placeholder="Patient name…" />
            <FilterInput reportKey="callPending" field="priority">
              <option value="">All Priorities</option>
              {['critical','high','medium','low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterInput>
            <FilterInput reportKey="callPending" field="patientType">
              <option value="">All Types</option>
              {['regular','chronic','critical','new'].map((t) => <option key={t} value={t}>{t}</option>)}
            </FilterInput>
            <ExportBar reportKey="callPending" filename="refill-call-pending" />
          </div>
          <ReportTable 
            columns={callCols} 
            rows={reportData.callPending} 
            loading={reportLoading.callPending}
            emptyMsg="Run report to see call-pending patients." 
          />
        </Section>

        {/* 5. Dispatch Pending */}
        <Section title="5. Dispatch Pending Report">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <FilterInput reportKey="dispatchPending" field="search" placeholder="Patient name…" />
            <FilterInput reportKey="dispatchPending" field="priority">
              <option value="">All Priorities</option>
              {['critical','high','medium','low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterInput>
            <FilterInput reportKey="dispatchPending" field="deliveryMode">
              <option value="">All Delivery Modes</option>
              {['pickup','home_delivery','courier','online'].map((m) => <option key={m} value={m}>{DELIVERY_LABEL[m]}</option>)}
            </FilterInput>
            <ExportBar reportKey="dispatchPending" filename="refill-dispatch-pending" />
          </div>
          <ReportTable 
            columns={dispatchCols} 
            rows={reportData.dispatchPending} 
            loading={reportLoading.dispatchPending}
            emptyMsg="Run report to see dispatch-pending items." 
          />
        </Section>

        {/* 6. Staff-wise Performance */}
        <Section title="6. Staff-wise Refill Workflow Performance">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <ExportBar reportKey="staffPerf" filename="refill-staff-performance" />
          </div>
          <ReportTable 
            columns={staffPerfCols} 
            rows={reportData.staffPerf} 
            loading={reportLoading.staffPerf}
            emptyMsg="Run report to see staff performance." 
          />
        </Section>

        {/* 7. Shiprocket Pending */}
        <Section title="7. Shiprocket Dispatch Pending Report">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <FilterInput reportKey="shiprocket" field="search" placeholder="Patient name…" />
            <FilterInput reportKey="shiprocket" field="priority">
              <option value="">All Priorities</option>
              {['critical','high','medium','low'].map((p) => <option key={p} value={p}>{p}</option>)}
            </FilterInput>
            <ExportBar reportKey="shiprocket" filename="refill-shiprocket" />
          </div>
          <ReportTable
            columns={dispatchCols}
            rows={reportData.shiprocket}
            loading={reportLoading.shiprocket}
            emptyMsg="Run report to see Shiprocket courier-pending dispatches."
          />
        </Section>
      </div>

      {/* Print note */}
      <p className="hidden print:block text-xs text-slate-400 text-center mt-4">
        Anjani Medical — Refill Command Dashboard — Printed {new Date().toLocaleString()}
      </p>
    </div>
  )
}
