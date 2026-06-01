import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStaff, createStaff, updateStaff, deleteStaff, getTasks, createAuditLog } from '../services/api'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'
import { getPreferenceColor, getPreferenceLabel, getPreferenceIcon } from '../services/notificationService'

const DEPARTMENTS = [
  'Sales', 'Purchase', 'Stock Audit', 'RGHS', 'Customer Support',
  'Delivery', 'Billing', 'Expiry Return', 'Admin', 'Cleaning', 'Accounts',
]
const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']
const NOTIFICATION_PREFS = ['App', 'WhatsApp', 'Email', 'SMS', 'None']
const DEFAULT_FORM = {
  name: '', role: '', department: '', color: '#3b82f6', status: 'active',
  mobile_number: '', email: '', whatsapp_number: '', notification_preference: 'App',
  timing: '', main_responsibility: '',
}

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ name, color }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
      style={{ background: color + '22', border: `2px solid ${color}55`, color }}
    >
      {initials(name)}
    </div>
  )
}

function CompletionBar({ pct }) {
  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">Task completion</span>
        <span className="text-slate-600 font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-white border border-[#D1DCF0] rounded-lg px-3 py-2 text-[#111827] text-sm placeholder-slate-400 focus:outline-none focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10'

function StaffModal({ title, onClose, onSave, form, setForm, saving }) {
  const handle = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-[#D1DCF0]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[#111827] font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Full Name *</label>
            <input value={form.name} onChange={handle('name')} placeholder="e.g. Virendra Singh" className={inputCls} />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Role *</label>
            <input value={form.role} onChange={handle('role')} placeholder="e.g. Sales Manager" className={inputCls} />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Department</label>
            <select value={form.department} onChange={handle('department')} className={inputCls}>
              <option value="">-- Select department --</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Timing</label>
            <input
              value={form.timing}
              onChange={handle('timing')}
              placeholder="8:00 AM - 6:30 PM"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Main Responsibility</label>
            <textarea
              value={form.main_responsibility}
              onChange={handle('main_responsibility')}
              placeholder="Primary daily responsibility"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Mobile Number *</label>
            <input
              type="tel"
              value={form.mobile_number}
              onChange={handle('mobile_number')}
              placeholder="98291 00000"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={handle('email')}
              placeholder="name@anjanimedical.in"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">WhatsApp Number</label>
            <input
              type="tel"
              value={form.whatsapp_number}
              onChange={handle('whatsapp_number')}
              placeholder="Same as mobile if same"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Notification Preference</label>
            <select value={form.notification_preference} onChange={handle('notification_preference')} className={inputCls}>
              {NOTIFICATION_PREFS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Color</label>
            <div className="flex gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: form.color === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset: '2px',
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-slate-600 text-xs font-medium block mb-1.5">Status</label>
            <select value={form.status} onChange={handle('status')} className={inputCls}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
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
            disabled={saving || !form.name.trim() || !form.role.trim() || !form.mobile_number.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0A3D91] hover:bg-[#0057D9] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving...' : title.startsWith('Edit') ? 'Update' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeactivate({ name, onConfirm, onCancel, saving }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#D1DCF0]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-[#111827] font-semibold text-sm">Deactivate Staff Member</p>
            <p className="text-slate-400 text-xs">This is reversible -- task history is preserved.</p>
          </div>
        </div>
        <p className="text-slate-600 text-sm mb-5">
          Set <span className="text-[#111827] font-semibold">{name}</span> to inactive?
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
            {saving ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Staff() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  useEffect(() => {
    if (user?.role === 'staff') navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const [staff, setStaff] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [staffData, tasksData] = await Promise.all([getStaff(), getTasks()])
      setStaff(staffData)
      setTasks(tasksData)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function completion(staffId) {
    const mine = tasks.filter((t) => t.assigned_to === staffId)
    if (!mine.length) return 0
    return Math.round((mine.filter((t) => t.status === 'completed').length / mine.length) * 100)
  }

  function openAdd() {
    setForm(DEFAULT_FORM)
    setShowAdd(true)
  }

  function openEdit(s) {
    setEditTarget(s)
    setForm({
      name: s.name,
      role: s.role || '',
      department: s.department || '',
      color: s.color || '#3b82f6',
      status: s.status,
      mobile_number: s.mobile_number || '',
      email: s.email || '',
      whatsapp_number: s.whatsapp_number || '',
      notification_preference: s.notification_preference || 'App',
      timing: s.timing || '',
      main_responsibility: s.main_responsibility || '',
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editTarget) {
        await updateStaff(editTarget.id, form)
        setEditTarget(null)
        toast('Staff member updated', 'success')
        createAuditLog({ action: 'staff_edited', entity_type: 'staff', entity_id: editTarget.id, user_name: user?.name, details: `Staff '${form.name}' updated` }).catch(() => {})
      } else {
        const created = await createStaff(form)
        setShowAdd(false)
        toast('Staff member added', 'success')
        createAuditLog({ action: 'staff_added', entity_type: 'staff', entity_id: created?.id ?? null, user_name: user?.name, details: `Staff '${form.name}' added as ${form.role}` }).catch(() => {})
      }
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(s) {
    setSaving(true)
    try {
      const newStatus = s.status === 'active' ? 'inactive' : 'active'
      await updateStaff(s.id, { status: newStatus })
      toast(`${s.name} set to ${newStatus}`, 'success')
      createAuditLog({ action: `staff_${newStatus}`, entity_type: 'staff', entity_id: s.id, user_name: user?.name, details: `'${s.name}' set to ${newStatus}` }).catch(() => {})
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
      setDeactivateTarget(null)
    }
  }

  async function handleDeactivate() {
    setSaving(true)
    try {
      await updateStaff(deactivateTarget.id, { status: 'inactive' })
      setDeactivateTarget(null)
      toast('Staff member deactivated', 'success')
      createAuditLog({ action: 'staff_deactivated', entity_type: 'staff', entity_id: deactivateTarget.id, user_name: user?.name, details: `'${deactivateTarget.name}' set to inactive` }).catch(() => {})
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] tracking-tight mb-1">Staff Management</h2>
          <p className="text-slate-500 text-sm">Manage team members, roles, and assignments.</p>
        </div>
        {hasPermission('manage_staff') && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#0A3D91] hover:bg-[#0057D9] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Staff
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#0A3D91]/20 border-t-[#0A3D91] rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-white rounded-2xl p-5 border border-[#D1DCF0] border-l-4 border-l-red-500 mb-6">
          <p className="text-red-500 text-sm">Failed to load staff: {error}</p>
          <button onClick={load} className="text-[#0A3D91] text-xs mt-2 hover:underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400 text-sm">
              No staff members yet. Click "Add Staff" to get started.
            </div>
          ) : (
            staff.map((s) => {
              const pct = completion(s.id)
              const isActive = s.status === 'active'
              return (
                <div key={s.id} className={`bg-white rounded-2xl p-5 flex flex-col gap-4 border border-[#D1DCF0] shadow-sm ${!isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={s.name} color={s.color || '#3b82f6'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#111827] font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-slate-500 text-xs truncate">
                        {[s.role, s.department].filter(Boolean).join(' - ')}
                      </p>
                      {s.timing && (
                        <p className="text-slate-500 text-xs mt-0.5">{s.timing}</p>
                      )}
                      {s.mobile_number && (
                        <p className="text-slate-500 text-xs mt-0.5">📱 {s.mobile_number}</p>
                      )}
                      {s.notification_preference && (
                        <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getPreferenceColor(s.notification_preference)}`}>
                          {getPreferenceIcon(s.notification_preference)} {getPreferenceLabel(s.notification_preference)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-red-50 text-red-500 border border-red-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <CompletionBar pct={pct} />

                  {s.main_responsibility && (
                    <p className="text-slate-600 text-xs leading-relaxed rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2">
                      {s.main_responsibility}
                    </p>
                  )}

                  {(hasPermission('manage_staff') || hasPermission('delete_staff')) && (
                    <div className="flex gap-2">
                      {hasPermission('manage_staff') && (
                        <button
                          onClick={() => openEdit(s)}
                          className="flex-1 py-1.5 rounded-lg border border-[#D1DCF0] text-slate-600 text-xs hover:bg-blue-50 hover:text-[#0A3D91] transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {hasPermission('delete_staff') && (
                        isActive ? (
                          <button
                            onClick={() => setDeactivateTarget(s)}
                            className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(s)}
                            disabled={saving}
                            className="flex-1 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 text-xs hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {showAdd && (
        <StaffModal
          title="Add Staff Member"
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          form={form}
          setForm={setForm}
          saving={saving}
        />
      )}

      {editTarget && (
        <StaffModal
          title="Edit Staff Member"
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          form={form}
          setForm={setForm}
          saving={saving}
        />
      )}

      {deactivateTarget && (
        <ConfirmDeactivate
          name={deactivateTarget.name}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
          saving={saving}
        />
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
