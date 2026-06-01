import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTasks, getStaff, createTask, updateTask, updateTaskStatus, deleteTask, createAuditLog, getTaskTemplates } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'
import { getRecurrenceLabel } from '../utils/recurrence'

const DEPARTMENTS = [
  'Sales', 'Purchase', 'Stock Audit', 'RGHS', 'Customer Support',
  'Delivery', 'Billing', 'Expiry Return', 'Admin', 'Cleaning / Store Maintenance',
]
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['pending', 'in_progress', 'completed', 'delayed']
const RECURRENCE_TYPES = ['none', 'daily', 'weekly', 'monthly', 'custom']
const WEEKDAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-600 border border-red-200' },
  high:     { label: 'High',     cls: 'bg-orange-50 text-orange-600 border border-orange-200' },
  medium:   { label: 'Medium',   cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  low:      { label: 'Low',      cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  delayed:     { label: 'Delayed',     cls: 'bg-red-50 text-red-600 border border-red-200' },
}

const DEFAULT_FORM = {
  title: '', description: '', category: '', priority: 'medium',
  status: 'pending', assigned_to: '', due_date: '', due_time: '',
  is_recurring: false, recurrence_type: 'none', recurrence_days: [], recurrence_end_date: '',
  template_id: '',
}

function statusLabel(s) {
  return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)
}

function StatusIcon({ status }) {
  if (status === 'pending') return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
  if (status === 'in_progress') return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
  if (status === 'completed') return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
  if (status === 'delayed') return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
  return null
}

const inputCls =
  'w-full bg-white border border-[#D1DCF0] rounded-lg px-3 py-2 text-[#111827] text-sm placeholder-slate-400 focus:outline-none focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10'

// ── Template Picker ──────────────────────────────────────────────────────────

function TemplatePicker({ onSelect, selectedId, templates = [] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
    )
  }, [search, templates])

  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach((t) => {
      const cat = t.category || 'Uncategorized'
      if (!map[cat]) map[cat] = []
      map[cat].push(t)
    })
    return map
  }, [filtered])

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1DCF0] text-slate-600 text-xs hover:border-[#0A3D91]/40 hover:text-[#0A3D91] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Start from template
        </button>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-slate-400 text-xs hover:text-red-500 transition-colors"
          >
            Clear template
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-30 bg-white rounded-xl shadow-2xl border border-[#D1DCF0] w-full min-w-[340px] max-h-72 flex flex-col">
          <div className="p-2 border-b border-[#F0F4FF]">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-slate-50 border border-[#D1DCF0] rounded-lg px-3 py-1.5 text-xs text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0A3D91]"
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {Object.keys(byCategory).length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-4">No templates found.</p>
            ) : (
              Object.entries(byCategory).map(([cat, items]) => (
                <div key={cat} className="mb-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">{cat}</p>
                  {items.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => { onSelect(tpl); setOpen(false); setSearch('') }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        selectedId === tpl.id
                          ? 'bg-blue-50 text-[#0A3D91] font-semibold'
                          : 'text-[#111827] hover:bg-blue-50/60'
                      }`}
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recurrence Section ───────────────────────────────────────────────────────

function RecurrenceSection({ form, setForm }) {
  const toggleDay = (day) => {
    setForm((p) => {
      const days = p.recurrence_days.includes(day)
        ? p.recurrence_days.filter((d) => d !== day)
        : [...p.recurrence_days, day]
      return { ...p, recurrence_days: days }
    })
  }

  const showDays = form.recurrence_type === 'weekly' || form.recurrence_type === 'custom'

  return (
    <div className="border border-[#D1DCF0] rounded-xl p-3 space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-700 text-xs font-semibold">Recurring Task</p>
          <p className="text-slate-400 text-[10px]">Task repeats automatically on selected schedule</p>
        </div>
        <button
          type="button"
          onClick={() => setForm((p) => ({ ...p, is_recurring: !p.is_recurring, recurrence_type: p.is_recurring ? 'none' : 'daily' }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            form.is_recurring ? 'bg-[#0A3D91]' : 'bg-slate-200'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            form.is_recurring ? 'translate-x-4' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {form.is_recurring && (
        <>
          {/* Recurrence type */}
          <div>
            <label className="text-slate-600 text-[10px] font-medium block mb-1">Repeat</label>
            <div className="flex gap-1.5 flex-wrap">
              {RECURRENCE_TYPES.filter((t) => t !== 'none').map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, recurrence_type: type }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors capitalize ${
                    form.recurrence_type === type
                      ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                      : 'bg-white text-slate-600 border-[#D1DCF0] hover:border-[#0A3D91]/40'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Day checkboxes */}
          {showDays && (
            <div>
              <label className="text-slate-600 text-[10px] font-medium block mb-1">Days</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`w-9 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                      form.recurrence_days.includes(key)
                        ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                        : 'bg-white text-slate-500 border-[#D1DCF0] hover:border-[#0A3D91]/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End date */}
          <div>
            <label className="text-slate-600 text-[10px] font-medium block mb-1">End Date (optional)</label>
            <input
              type="date"
              value={form.recurrence_end_date}
              onChange={(e) => setForm((p) => ({ ...p, recurrence_end_date: e.target.value }))}
              className={inputCls}
            />
            <p className="text-slate-400 text-[10px] mt-1">Task will auto-appear on selected days</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ title, onClose, onSave, form, setForm, saving, staffList, activeStaffList, templates = [] }) {
  const handle = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function applyTemplate(tpl) {
    if (!tpl) {
      setForm((p) => ({ ...p, title: '', description: '', category: '', priority: 'medium', template_id: '' }))
      return
    }
    setForm((p) => ({
      ...p,
      title: tpl.title,
      description: tpl.description || '',
      category: tpl.category || '',
      priority: tpl.priority || 'medium',
      template_id: tpl.id,
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto border border-[#D1DCF0]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[#111827] font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Template picker */}
          <TemplatePicker onSelect={applyTemplate} selectedId={form.template_id} templates={templates} />

          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Title *</label>
            <input value={form.title} onChange={handle('title')} placeholder="Task title" className={inputCls} />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={handle('description')}
              placeholder="Optional details..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1.5">Category *</label>
              <select value={form.category} onChange={handle('category')} className={inputCls}>
                <option value="">-- Select --</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1.5">Priority *</label>
              <select value={form.priority} onChange={handle('priority')} className={inputCls}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1.5">Status</label>
              <select value={form.status} onChange={handle('status')} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1.5">Assigned To</label>
              <select value={form.assigned_to} onChange={handle('assigned_to')} className={inputCls}>
                <option value="">-- Unassigned --</option>
                {activeStaffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1.5">
                {form.is_recurring ? 'Start Date' : 'Due Date'}
              </label>
              <input type="date" value={form.due_date} onChange={handle('due_date')} className={inputCls} />
            </div>
            <div>
              <label className="text-slate-600 text-xs font-medium block mb-1.5">Due Time</label>
              <input type="time" value={form.due_time} onChange={handle('due_time')} className={inputCls} />
            </div>
          </div>

          {/* Recurrence */}
          <RecurrenceSection form={form} setForm={setForm} />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-[#D1DCF0] text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title.trim() || !form.category}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0A3D91] hover:bg-[#0057D9] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving...' : title.startsWith('Edit') ? 'Update Task' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ task, onConfirm, onCancel, saving }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#D1DCF0]">
        <p className="text-[#111827] font-semibold mb-2">Delete Task?</p>
        <p className="text-slate-500 text-sm mb-5">
          "<span className="text-[#111827]">{task.title}</span>" will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-[#D1DCF0] text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Recurrence Badge ─────────────────────────────────────────────────────────

function RecurrenceBadge({ task }) {
  if (!task.is_recurring) return null
  const label = getRecurrenceLabel(task)
  if (!label) return null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {label}
    </span>
  )
}

// ── Status Dropdown ──────────────────────────────────────────────────────────

const STAFF_STATUSES = ['in_progress', 'completed']

function StatusDropdown({ task, onSelect, isStaff }) {
  const options = isStaff ? STAFF_STATUSES : STATUSES
  return (
    <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl p-1 min-w-[136px] shadow-xl border border-[#D1DCF0]">
      {options.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
            task.status === s
              ? 'text-[#0A3D91] bg-blue-50 font-semibold'
              : 'text-slate-600 hover:bg-blue-50'
          }`}
        >
          {statusLabel(s)}
        </button>
      ))}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Tasks() {
  const [searchParams] = useSearchParams()
  const { user, hasPermission } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  const [tasks, setTasks] = useState([])
  const [staffList, setStaffList] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({
    status: '', priority: '', category: '', assigned_to: '',
    date: searchParams.get('date') || '',
    search: '',
  })

  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [statusMenu, setStatusMenu] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [tasksData, staffData, templatesData] = await Promise.all([
        getTasks(),
        getStaff(),
        getTaskTemplates(true)
      ])
      setTasks(tasksData)
      setStaffList(staffData)
      setTemplates(templatesData)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const staffMap = useMemo(() => {
    const m = {}
    staffList.forEach((s) => { m[s.id] = s })
    return m
  }, [staffList])

  const activeStaffList = useMemo(() => {
    return staffList.filter((s) => s.status !== 'inactive')
  }, [staffList])

  const myStaffId = useMemo(() => {
    if (user?.role !== 'staff') return null
    const match = staffList.find((s) => s.name === user.name)
    return match ? match.id : null
  }, [user, staffList])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (user?.role === 'staff') {
        if (myStaffId === null) return false
        if (String(t.assigned_to) !== String(myStaffId)) return false
      }
      if (filters.status && t.status !== filters.status) return false
      if (filters.priority && t.priority !== filters.priority) return false
      if (filters.category && t.category !== filters.category) return false
      if (filters.assigned_to && String(t.assigned_to) !== String(filters.assigned_to)) return false
      if (filters.date && t.due_date !== filters.date) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.description || '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [tasks, filters, user, myStaffId])

  function openAdd() {
    setForm(DEFAULT_FORM)
    setShowAdd(true)
  }

  function openEdit(t) {
    setEditTarget(t)
    let days = []
    try { days = t.recurrence_days ? JSON.parse(t.recurrence_days) : [] } catch { days = [] }
    setForm({
      title: t.title,
      description: t.description || '',
      category: t.category || '',
      priority: t.priority || 'medium',
      status: t.status || 'pending',
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : '',
      due_date: t.due_date || '',
      due_time: t.due_time || '',
      is_recurring: !!t.is_recurring,
      recurrence_type: t.recurrence_type || 'none',
      recurrence_days: days,
      recurrence_end_date: t.recurrence_end_date || '',
      template_id: t.template_id || '',
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to !== '' ? Number(form.assigned_to) : null,
        is_recurring: form.is_recurring ? 1 : 0,
        recurrence_days: form.recurrence_days.length ? JSON.stringify(form.recurrence_days) : null,
        recurrence_type: form.is_recurring ? form.recurrence_type : 'none',
        recurrence_end_date: form.recurrence_end_date || null,
        template_id: form.template_id || null,
      }
      if (editTarget) {
        await updateTask(editTarget.id, payload)
        setEditTarget(null)
        toast('Task updated', 'success')
        createAuditLog({ action: 'task_edited', entity_type: 'task', entity_id: editTarget.id, user_name: user?.name, details: `Task '${payload.title}' updated` }).catch(() => {})
      } else {
        const created = await createTask(payload)
        setShowAdd(false)
        toast('Task created', 'success')
        createAuditLog({ action: 'task_added', entity_type: 'task', entity_id: created?.id ?? null, user_name: user?.name, details: `Task '${payload.title}' created` }).catch(() => {})
      }
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteTask(deleteTarget.id)
      createAuditLog({ action: 'task_deleted', entity_type: 'task', entity_id: deleteTarget.id, user_name: user?.name, details: `Task '${deleteTarget.title}' deleted` }).catch(() => {})
      setDeleteTarget(null)
      toast('Task deleted', 'success')
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(taskId, status) {
    try {
      await updateTaskStatus(taskId, status)
      setStatusMenu(null)
      toast('Status updated', 'success')
      const t = tasks.find((x) => x.id === taskId)
      createAuditLog({ action: 'task_status_changed', entity_type: 'task', entity_id: taskId, user_name: user?.name, details: `Task '${t?.title ?? taskId}' marked as ${status}` }).catch(() => {})
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    }
  }

  const setFilter = (k) => (e) => setFilters((p) => ({ ...p, [k]: e.target.value }))
  const hasFilters = Object.values(filters).some(Boolean)
  const filterSelectCls =
    'bg-white border border-[#D1DCF0] rounded-lg px-3 py-1.5 text-sm text-[#111827] focus:outline-none focus:border-[#0A3D91]'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] tracking-tight mb-1">Task Management</h2>
          <p className="text-slate-500 text-sm">Create, filter, and manage all staff tasks.</p>
        </div>
        {hasPermission('manage_tasks') && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#0A3D91] hover:bg-[#0057D9] text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 mb-6 border border-[#D1DCF0] shadow-sm">
        <div className="flex gap-3 flex-wrap items-center">
          <select value={filters.status} onChange={setFilter('status')} className={filterSelectCls}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={filters.priority} onChange={setFilter('priority')} className={filterSelectCls}>
            <option value="">All Priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select value={filters.category} onChange={setFilter('category')} className={filterSelectCls}>
            <option value="">All Categories</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.assigned_to} onChange={setFilter('assigned_to')} className={filterSelectCls}>
            <option value="">All Staff</option>
            {activeStaffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={filters.date} onChange={setFilter('date')} className={filterSelectCls} />
          <div className="relative flex-1 min-w-[160px]">
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={filters.search}
              onChange={setFilter('search')}
              placeholder="Search title or description..."
              className="w-full bg-white border border-[#D1DCF0] rounded-lg px-3 py-1.5 pl-8 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0A3D91]"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() => setFilters({ status: '', priority: '', category: '', assigned_to: '', date: '', search: '' })}
              className="text-slate-500 text-xs hover:text-[#0A3D91] transition-colors whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#0A3D91]/20 border-t-[#0A3D91] rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-white rounded-2xl p-5 border border-[#D1DCF0] border-l-4 border-l-red-500">
          <p className="text-red-500 text-sm">Failed to load tasks: {error}</p>
          <button onClick={load} className="text-[#0A3D91] text-xs mt-2 hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-[#D1DCF0] shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EFFF]">
                  {['Task', 'Category', 'Priority', 'Status', 'Assigned', 'Due', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3.5 text-slate-500 text-xs font-semibold uppercase tracking-wider ${h ? 'text-left' : 'text-right'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FF]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-14 text-slate-400 text-sm">
                      No tasks match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const assignee = staffMap[t.assigned_to]
                    const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.low
                    const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3.5 max-w-[240px]">
                          <p className="text-[#111827] font-medium truncate">{t.title}</p>
                          {t.description && (
                            <p className="text-slate-400 text-xs truncate mt-0.5">{t.description}</p>
                          )}
                          <RecurrenceBadge task={t} />
                        </td>
                        <td className="px-4 py-3.5">
                          {t.category && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#0A3D91] border border-blue-100">
                              {t.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pr.cls}`}>
                            {pr.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>
                            <StatusIcon status={t.status} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {assignee ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: assignee.color || '#64748b' }} />
                              <span className="text-slate-600 text-xs truncate max-w-[100px]">{assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {t.due_date ? (
                            <div>
                              <p className="text-slate-600 text-xs">{t.due_date}</p>
                              {t.due_time && <p className="text-slate-400 text-xs">{t.due_time}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            {hasPermission('manage_tasks') && (
                              <button
                                onClick={() => openEdit(t)}
                                className="px-2.5 py-1 rounded border border-[#D1DCF0] text-slate-500 text-xs hover:text-[#0A3D91] hover:border-[#0A3D91]/30 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                            <div className="relative">
                              <button
                                onClick={() => setStatusMenu(statusMenu === t.id ? null : t.id)}
                                className="px-2.5 py-1 rounded border border-[#D1DCF0] text-slate-500 text-xs hover:text-[#0A3D91] hover:border-[#0A3D91]/30 transition-colors"
                              >
                                Status v
                              </button>
                              {statusMenu === t.id && (
                                <StatusDropdown task={t} onSelect={(s) => handleStatusChange(t.id, s)} isStaff={user?.role === 'staff'} />
                              )}
                            </div>
                            {hasPermission('delete_tasks') && (
                              <button
                                onClick={() => setDeleteTarget(t)}
                                className="px-2.5 py-1 rounded border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-14 text-slate-400 text-sm">
                No tasks match the current filters.
              </div>
            ) : (
              filtered.map((t) => {
                const assignee = staffMap[t.assigned_to]
                const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.low
                const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                return (
                  <div key={t.id} className="bg-white rounded-2xl p-4 border border-[#D1DCF0] shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#111827] font-semibold text-sm truncate">{t.title}</p>
                        {t.description && (
                          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${pr.cls}`}>
                        {pr.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {t.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#0A3D91] border border-blue-100">
                          {t.category}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>
                        <StatusIcon status={t.status} />
                        {st.label}
                      </span>
                      <RecurrenceBadge task={t} />
                    </div>

                    <div className="flex items-center justify-between text-xs mb-3">
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assignee.color || '#64748b' }} />
                          <span className="text-slate-600">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                      {t.due_date && (
                        <span className="text-slate-500">{t.due_date}{t.due_time ? ` ${t.due_time}` : ''}</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {hasPermission('manage_tasks') && (
                        <button
                          onClick={() => openEdit(t)}
                          className="flex-1 py-1.5 rounded-lg border border-[#D1DCF0] text-slate-600 text-xs hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <div className="relative flex-1">
                        <button
                          onClick={() => setStatusMenu(statusMenu === t.id ? null : t.id)}
                          className="w-full py-1.5 rounded-lg border border-[#D1DCF0] text-slate-600 text-xs hover:bg-blue-50 transition-colors"
                        >
                          Status v
                        </button>
                        {statusMenu === t.id && (
                          <div className="absolute left-0 bottom-full mb-1 z-20 bg-white rounded-xl p-1 min-w-[136px] shadow-xl border border-[#D1DCF0]">
                            {(user?.role === 'staff' ? STAFF_STATUSES : STATUSES).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(t.id, s)}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  t.status === s
                                    ? 'text-[#0A3D91] bg-blue-50 font-semibold'
                                    : 'text-slate-600 hover:bg-blue-50'
                                }`}
                              >
                                {statusLabel(s)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {hasPermission('delete_tasks') && (
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {tasks.length > 0 && (
            <p className="text-slate-400 text-xs text-center mt-4">
              Showing {filtered.length} of {tasks.length} tasks
            </p>
          )}
        </>
      )}

      {showAdd && (
        <TaskModal
          title="Add Task"
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          form={form}
          setForm={setForm}
          saving={saving}
          staffList={staffList}
          activeStaffList={activeStaffList}
          templates={templates}
        />
      )}
      {editTarget && (
        <TaskModal
          title="Edit Task"
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          form={form}
          setForm={setForm}
          saving={saving}
          staffList={staffList}
          activeStaffList={activeStaffList}
          templates={templates}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          task={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          saving={saving}
        />
      )}

      {statusMenu !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusMenu(null)} />
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
