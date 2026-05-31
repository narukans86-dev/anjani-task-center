import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getTasks, getStaff, createTask, updateTask, updateTaskStatus, deleteTask } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = [
  'Sales', 'Purchase', 'Stock Audit', 'RGHS', 'Customer Support',
  'Delivery', 'Billing', 'Expiry Return', 'Admin', 'Cleaning',
]
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['pending', 'in_progress', 'completed', 'delayed']

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  high:     { label: 'High',     cls: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  medium:   { label: 'Medium',   cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  low:      { label: 'Low',      cls: 'bg-slate-600/20 text-slate-400 border border-slate-600/30' },
}

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  delayed:     { label: 'Delayed',     cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
}

const DEFAULT_FORM = {
  title: '', description: '', category: '', priority: 'medium',
  status: 'pending', assigned_to: '', due_date: '', due_time: '',
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

function TaskModal({ title, onClose, onSave, form, setForm, saving, staffList }) {
  const handle = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const inputCls =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-glass rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Title *</label>
            <input value={form.title} onChange={handle('title')} placeholder="Task title" className={inputCls} />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={handle('description')}
              placeholder="Optional details…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Category *</label>
              <select value={form.category} onChange={handle('category')} className={inputCls}>
                <option value="">— Select —</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Priority *</label>
              <select value={form.priority} onChange={handle('priority')} className={inputCls}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Status</label>
              <select value={form.status} onChange={handle('status')} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Assigned To</label>
              <select value={form.assigned_to} onChange={handle('assigned_to')} className={inputCls}>
                <option value="">— Unassigned —</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Due Date</label>
              <input type="date" value={form.due_date} onChange={handle('due_date')} className={inputCls} />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Due Time</label>
              <input type="time" value={form.due_time} onChange={handle('due_time')} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title.trim() || !form.category}
            className="flex-1 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving…' : title.startsWith('Edit') ? 'Update Task' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ task, onConfirm, onCancel, saving }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card-glass rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <p className="text-white font-semibold mb-2">Delete Task?</p>
        <p className="text-slate-400 text-sm mb-5">
          "<span className="text-slate-200">{task.title}</span>" will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STAFF_STATUSES = ['in_progress', 'completed']

function StatusDropdown({ task, onSelect, isStaff }) {
  const options = isStaff ? STAFF_STATUSES : STATUSES
  return (
    <div className="absolute right-0 top-full mt-1 z-20 card-glass rounded-xl p-1 min-w-[136px] shadow-xl border border-slate-700/60">
      {options.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
            task.status === s
              ? 'text-teal-400 bg-teal-500/10'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {statusLabel(s)}
        </button>
      ))}
    </div>
  )
}

export default function Tasks() {
  const [searchParams] = useSearchParams()
  const { user, hasPermission } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  const [tasks, setTasks] = useState([])
  const [staffList, setStaffList] = useState([])
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
      const [tasksData, staffData] = await Promise.all([getTasks(), getStaff()])
      setTasks(tasksData)
      setStaffList(staffData)
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

  // For staff role: find their staff record by name match to scope visible tasks
  const myStaffId = useMemo(() => {
    if (user?.role !== 'staff') return null
    const match = staffList.find((s) => s.name === user.name)
    return match ? match.id : null
  }, [user, staffList])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      // Staff can only see their own tasks
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
    setForm({
      title: t.title,
      description: t.description || '',
      category: t.category || '',
      priority: t.priority || 'medium',
      status: t.status || 'pending',
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : '',
      due_date: t.due_date || '',
      due_time: t.due_time || '',
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to !== '' ? Number(form.assigned_to) : null,
      }
      if (editTarget) {
        await updateTask(editTarget.id, payload)
        setEditTarget(null)
        toast('Task updated', 'success')
      } else {
        await createTask(payload)
        setShowAdd(false)
        toast('Task created', 'success')
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
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    }
  }

  const setFilter = (k) => (e) => setFilters((p) => ({ ...p, [k]: e.target.value }))
  const hasFilters = Object.values(filters).some(Boolean)
  const selectCls =
    'bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-teal-500/60'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Task Management</h2>
          <p className="text-slate-400 text-sm">Create, filter, and manage all staff tasks.</p>
        </div>
        {hasPermission('manage_tasks') && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="card-glass rounded-2xl p-4 mb-6">
        <div className="flex gap-3 flex-wrap items-center">
          <select value={filters.status} onChange={setFilter('status')} className={selectCls}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={filters.priority} onChange={setFilter('priority')} className={selectCls}>
            <option value="">All Priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select value={filters.category} onChange={setFilter('category')} className={selectCls}>
            <option value="">All Categories</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.assigned_to} onChange={setFilter('assigned_to')} className={selectCls}>
            <option value="">All Staff</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="date"
            value={filters.date}
            onChange={setFilter('date')}
            className={selectCls}
          />
          <div className="relative flex-1 min-w-[160px]">
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={filters.search}
              onChange={setFilter('search')}
              placeholder="Search title or description…"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 pl-8 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() => setFilters({ status: '', priority: '', category: '', assigned_to: '', date: '', search: '' })}
              className="text-slate-400 text-xs hover:text-white transition-colors whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="card-glass rounded-2xl p-5 border-l-2 border-l-red-500/60">
          <p className="text-red-400 text-sm">Failed to load tasks: {error}</p>
          <button onClick={load} className="text-teal-400 text-xs mt-2 hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Desktop table ─────────────────────────────────────────── */}
          <div className="hidden md:block card-glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70">
                  {['Task', 'Category', 'Priority', 'Status', 'Assigned', 'Due', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3.5 text-slate-400 text-xs font-medium uppercase tracking-wider ${h ? 'text-left' : 'text-right'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-14 text-slate-500 text-sm">
                      No tasks match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const assignee = staffMap[t.assigned_to]
                    const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.low
                    const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                    return (
                      <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <p className="text-slate-200 font-medium truncate">{t.title}</p>
                          {t.description && (
                            <p className="text-slate-500 text-xs truncate mt-0.5">{t.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {t.category && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/30">
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
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: assignee.color || '#64748b' }}
                              />
                              <span className="text-slate-300 text-xs truncate max-w-[100px]">{assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {t.due_date ? (
                            <div>
                              <p className="text-slate-300 text-xs">{t.due_date}</p>
                              {t.due_time && <p className="text-slate-500 text-xs">{t.due_time}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            {hasPermission('manage_tasks') && (
                              <button
                                onClick={() => openEdit(t)}
                                className="px-2.5 py-1 rounded border border-slate-700 text-slate-400 text-xs hover:text-white hover:border-slate-500 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                            <div className="relative">
                              <button
                                onClick={() => setStatusMenu(statusMenu === t.id ? null : t.id)}
                                className="px-2.5 py-1 rounded border border-slate-700 text-slate-400 text-xs hover:text-white hover:border-slate-500 transition-colors"
                              >
                                Status ▾
                              </button>
                              {statusMenu === t.id && (
                                <StatusDropdown task={t} onSelect={(s) => handleStatusChange(t.id, s)} isStaff={user?.role === 'staff'} />
                              )}
                            </div>
                            {hasPermission('delete_tasks') && (
                              <button
                                onClick={() => setDeleteTarget(t)}
                                className="px-2.5 py-1 rounded border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
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

          {/* ── Mobile cards ──────────────────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-14 text-slate-500 text-sm">
                No tasks match the current filters.
              </div>
            ) : (
              filtered.map((t) => {
                const assignee = staffMap[t.assigned_to]
                const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.low
                const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                return (
                  <div key={t.id} className="card-glass rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 font-semibold text-sm truncate">{t.title}</p>
                        {t.description && (
                          <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${pr.cls}`}>
                        {pr.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {t.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/30">
                          {t.category}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>
                        <StatusIcon status={t.status} />
                        {st.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-3">
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assignee.color || '#64748b' }} />
                          <span className="text-slate-300">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">Unassigned</span>
                      )}
                      {t.due_date && (
                        <span className="text-slate-400">
                          {t.due_date}{t.due_time ? ` ${t.due_time}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {hasPermission('manage_tasks') && (
                        <button
                          onClick={() => openEdit(t)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <div className="relative flex-1">
                        <button
                          onClick={() => setStatusMenu(statusMenu === t.id ? null : t.id)}
                          className="w-full py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
                        >
                          Status ▾
                        </button>
                        {statusMenu === t.id && (
                          <div className="absolute left-0 bottom-full mb-1 z-20 card-glass rounded-xl p-1 min-w-[136px] shadow-xl border border-slate-700/60">
                            {(user?.role === 'staff' ? STAFF_STATUSES : STATUSES).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(t.id, s)}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  t.status === s
                                    ? 'text-teal-400 bg-teal-500/10'
                                    : 'text-slate-300 hover:bg-slate-800/60'
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
                          className="flex-1 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
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
            <p className="text-slate-600 text-xs text-center mt-4">
              Showing {filtered.length} of {tasks.length} tasks
            </p>
          )}
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <TaskModal
          title="Add Task"
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          form={form}
          setForm={setForm}
          saving={saving}
          staffList={staffList}
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

      {/* Backdrop to close status menu */}
      {statusMenu !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusMenu(null)} />
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
