import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import {
  getAllRefillSchedules,
  addRefillSchedule,
  updateRefillSchedule,
  pauseRefillSchedule,
  resumeRefillSchedule,
  deleteRefillSchedule,
  updateWorkflowStatus,
} from '../services/refillSchedules'
import { getStaff } from '../services/api'
import { getEffectiveRole } from '../services/permissions'

// ── Constants ─────────────────────────────────────────────────────────────

const DELIVERY_MODES = ['pickup', 'home_delivery', 'courier', 'online']
const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly', 'bimonthly', 'quarterly', 'custom']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const SCHEDULER_STATUSES = ['active', 'paused', 'cancelled']
const PATIENT_TYPES = ['regular', 'chronic', 'critical', 'new']

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'next_7', label: 'Next 7 Days' },
  { key: 'next_15', label: 'Next 15 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all', label: 'All' },
]

const PRIORITY_CFG = {
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-600 border border-red-200' },
  high:     { label: 'High',     cls: 'bg-orange-50 text-orange-600 border border-orange-200' },
  medium:   { label: 'Medium',   cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  low:      { label: 'Low',      cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const WORKFLOW_CFG = {
  upcoming:             { label: 'Scheduled',           cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
  stock_check_pending:  { label: 'Stock Check',         cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  reorder_required:     { label: 'Reorder Required',    cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  reorder_placed:       { label: 'Ordered',             cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  stock_available:      { label: 'Stock Ready',         cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
  patient_call_pending: { label: 'Call Patient',        cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
  patient_confirmed:    { label: 'Patient Confirmed',   cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  dispatch_pending:     { label: 'Ready to Dispatch',   cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  dispatched:           { label: 'Dispatched',          cls: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
  delivered:            { label: 'Delivered',           cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelled:            { label: 'Cancelled',           cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
  pending:              { label: 'Pending',             cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  in_progress:          { label: 'In Progress',         cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:            { label: 'Completed',           cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

const SCHEDULER_CFG = {
  active:    { label: 'Active',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  paused:    { label: 'Paused',    cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const DELIVERY_LABELS = {
  pickup: 'Pickup', home_delivery: 'Home Delivery', courier: 'Courier', online: 'Online',
}

// Simplified next-action config — one or two big buttons per state
// color: 'green' | 'blue' | 'orange' | 'red' | 'purple'
const NEXT_ACTIONS = {
  upcoming:             [{ to: 'stock_check_pending', label: 'Begin Stock Check', color: 'blue' }],
  stock_check_pending:  [
    { to: 'stock_available',  label: 'Stock Available',     color: 'green' },
    { to: 'reorder_required', label: 'Stock Not Available', color: 'orange' },
  ],
  reorder_required:     [{ to: 'reorder_placed',  label: 'Order Placed with Supplier', color: 'blue' }],
  reorder_placed:       [{ to: 'stock_available', label: 'Stock Received',             color: 'green' }],
  stock_available:      [{ to: 'patient_call_pending', label: 'Call Patient',          color: 'purple' }],
  patient_call_pending: [
    { to: 'patient_confirmed', label: 'Patient Confirmed',    color: 'green' },
    { to: 'cancelled',         label: 'Patient Cancelled',    color: 'red' },
  ],
  patient_confirmed:    [{ to: 'dispatch_pending', label: 'Ready to Dispatch', color: 'blue' }],
  dispatch_pending:     [{ to: 'dispatched',       label: 'Mark Dispatched',   color: 'blue' }],
  dispatched:           [{ to: 'delivered',        label: 'Confirm Delivered', color: 'green' }],
}

const ACTION_BTN_CLS = {
  green:  'bg-emerald-600 hover:bg-emerald-700 text-white',
  blue:   'bg-[#0A3D91] hover:bg-blue-800 text-white',
  orange: 'bg-orange-500 hover:bg-orange-600 text-white',
  red:    'bg-red-600 hover:bg-red-700 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
}

// 4-stage pipeline for visual display
const PIPELINE = [
  { key: 'stock',   label: 'Stock',     states: ['upcoming','stock_check_pending','reorder_required','reorder_placed','stock_available'] },
  { key: 'patient', label: 'Patient',   states: ['patient_call_pending','patient_confirmed'] },
  { key: 'dispatch',label: 'Dispatch',  states: ['dispatch_pending','dispatched'] },
  { key: 'done',    label: 'Done',      states: ['delivered'] },
]

function getPipelineStage(wfStatus) {
  if (wfStatus === 'cancelled') return -1
  for (let i = 0; i < PIPELINE.length; i++) {
    if (PIPELINE[i].states.includes(wfStatus)) return i
  }
  return 0
}

const DEFAULT_FORM = {
  patientName: '', patientMobile: '', patientWhatsapp: '', patientEmail: '',
  patientAddress: '', patientType: 'regular',
  refillDate: '', refillFrequency: 'monthly', customIntervalDays: '',
  nextRefillDate: '',
  assignedSalesStaffId: '', assignedPurchaseStaffId: '',
  deliveryMode: 'pickup', priority: 'medium',
  schedulerStatus: 'active', workflowStatus: 'upcoming',
  startReminderDaysBefore: 3, notes: '',
  medicines: [{ medicineName: '', strength: '', quantityRequired: 1, preferredBrand: '', substituteAllowed: false, notes: '' }],
}

// ── Date helpers ──────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function startOfWeek() { const d = new Date(), day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return d.toISOString().slice(0, 10) }
function endOfWeek() { const d = new Date(), day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day)); return d.toISOString().slice(0, 10) }
function startOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
function endOfMonth() { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().slice(0, 10) }

function applyDateFilter(schedules, filterKey) {
  if (!filterKey || filterKey === 'all') return schedules
  const t = today()
  return schedules.filter((s) => {
    const d = s.next_refill_date
    if (!d) return false
    if (filterKey === 'today') return d === t
    if (filterKey === 'this_week') return d >= startOfWeek() && d <= endOfWeek()
    if (filterKey === 'next_7') return d >= t && d <= addDays(7)
    if (filterKey === 'next_15') return d >= t && d <= addDays(15)
    if (filterKey === 'this_month') return d >= startOfMonth() && d <= endOfMonth()
    return true
  })
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Small UI pieces ───────────────────────────────────────────────────────

function Badge({ cfg, value }) {
  const c = cfg[value]
  if (!c) return <span className="text-slate-400 text-xs">—</span>
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${c.cls}`}>{c.label}</span>
}

function Select({ label, value, onChange, options, placeholder = 'All' }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-[#D1DCF0] rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91]">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </div>
  )
}

function Input({ label, required, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <input {...props} className="w-full text-sm border border-[#D1DCF0] rounded-lg px-3 py-2 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91]" />
    </div>
  )
}

function Textarea({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <textarea {...props} rows={3} className="w-full text-sm border border-[#D1DCF0] rounded-lg px-3 py-2 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91] resize-none" />
    </div>
  )
}

// ── Medicine row editor ────────────────────────────────────────────────────

function MedicineRow({ med, idx, onChange, onRemove, canRemove }) {
  const set = (field, val) => onChange(idx, { ...med, [field]: val })
  return (
    <div className="bg-blue-50/40 border border-[#D1DCF0] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Medicine {idx + 1}</span>
        {canRemove && (
          <button type="button" onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Input placeholder="Medicine name *" value={med.medicineName} onChange={(e) => set('medicineName', e.target.value)} required />
        </div>
        <Input placeholder="Strength (e.g. 500mg)" value={med.strength} onChange={(e) => set('strength', e.target.value)} />
        <Input type="number" placeholder="Qty required" min={1} value={med.quantityRequired} onChange={(e) => set('quantityRequired', +e.target.value)} />
        <Input placeholder="Preferred brand" value={med.preferredBrand} onChange={(e) => set('preferredBrand', e.target.value)} />
        <div className="flex items-center gap-2 mt-1">
          <input type="checkbox" id={`sub-${idx}`} checked={med.substituteAllowed} onChange={(e) => set('substituteAllowed', e.target.checked)}
            className="rounded border-slate-300 text-[#0A3D91] focus:ring-blue-200" />
          <label htmlFor={`sub-${idx}`} className="text-xs text-slate-600">Substitute OK</label>
        </div>
      </div>
    </div>
  )
}

// ── Schedule Form (Add / Edit) ─────────────────────────────────────────────

function ScheduleForm({ initial, staff, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial ?? DEFAULT_FORM)
  const [validationError, setValidationError] = useState('')

  const set = (field, val) => { setForm((f) => ({ ...f, [field]: val })); setValidationError('') }
  const updateMed = (idx, val) => setForm((f) => { const meds = [...f.medicines]; meds[idx] = val; return { ...f, medicines: meds } })
  const addMed = () => setForm((f) => ({ ...f, medicines: [...f.medicines, { medicineName: '', strength: '', quantityRequired: 1, preferredBrand: '', substituteAllowed: false, notes: '' }] }))
  const removeMed = (idx) => setForm((f) => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.patientName.trim()) { setValidationError('Patient name is required.'); return }
    if (!form.patientMobile.trim() && !form.patientWhatsapp.trim()) { setValidationError('Mobile or WhatsApp number is required.'); return }
    if (!form.refillDate) { setValidationError('Refill / Start Date is required.'); return }
    const hasMed = form.medicines.some((m) => (m.medicineName || '').trim())
    if (!hasMed) { setValidationError('At least one medicine name is required.'); return }
    setValidationError('')
    onSave(form)
  }

  const salesStaff = staff.filter((s) => s.department === 'Sales' || !s.department)
  const purchaseStaff = staff.filter((s) => s.department === 'Purchase' || !s.department)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-white h-full w-full max-w-xl shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b border-[#D1DCF0] px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#0A3D91]" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800 text-sm">{initial ? 'Edit Schedule' : 'New Refill Schedule'}</p>
            <p className="text-xs text-slate-500">Fill in patient and medicine details</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 px-5 py-5 space-y-6">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Patient Details</p>
            <div className="space-y-3">
              <Input label="Patient Name" required placeholder="Full name" value={form.patientName} onChange={(e) => set('patientName', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Mobile *" placeholder="10-digit number" value={form.patientMobile} onChange={(e) => set('patientMobile', e.target.value)} />
                <Input label="WhatsApp" placeholder="If different" value={form.patientWhatsapp} onChange={(e) => set('patientWhatsapp', e.target.value)} />
              </div>
              <Input label="Email" type="email" placeholder="Optional" value={form.patientEmail} onChange={(e) => set('patientEmail', e.target.value)} />
              <Textarea label="Address" placeholder="Delivery address" value={form.patientAddress} onChange={(e) => set('patientAddress', e.target.value)} />
              <Select label="Patient Type" value={form.patientType} onChange={(v) => set('patientType', v)}
                options={PATIENT_TYPES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} placeholder="" />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Refill Schedule</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Refill / Start Date" required type="date" value={form.refillDate} onChange={(e) => set('refillDate', e.target.value)} />
                <Input label="Next Refill Date" type="date" value={form.nextRefillDate} onChange={(e) => set('nextRefillDate', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Frequency" value={form.refillFrequency} onChange={(v) => set('refillFrequency', v)} placeholder=""
                  options={FREQUENCIES.map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))} />
                {form.refillFrequency === 'custom' && (
                  <Input label="Interval (days)" type="number" min={1} value={form.customIntervalDays} onChange={(e) => set('customIntervalDays', e.target.value)} placeholder="e.g. 45" />
                )}
              </div>
              <Input label="Reminder Days Before" type="number" min={0} max={14} value={form.startReminderDaysBefore} onChange={(e) => set('startReminderDaysBefore', +e.target.value)} />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Assignment</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Sales Staff" value={form.assignedSalesStaffId} onChange={(v) => set('assignedSalesStaffId', v)}
                  options={salesStaff.map((s) => ({ value: s.id, label: s.name }))} />
                <Select label="Purchase Staff" value={form.assignedPurchaseStaffId} onChange={(v) => set('assignedPurchaseStaffId', v)}
                  options={purchaseStaff.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Delivery Mode" value={form.deliveryMode} onChange={(v) => set('deliveryMode', v)} placeholder=""
                  options={DELIVERY_MODES.map((d) => ({ value: d, label: DELIVERY_LABELS[d] ?? d }))} />
                <Select label="Priority" value={form.priority} onChange={(v) => set('priority', v)} placeholder=""
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_CFG[p]?.label ?? p }))} />
              </div>
            </div>
          </section>

          {initial && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Status</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Scheduler Status" value={form.schedulerStatus} onChange={(v) => set('schedulerStatus', v)} placeholder=""
                  options={SCHEDULER_STATUSES.map((s) => ({ value: s, label: SCHEDULER_CFG[s]?.label ?? s }))} />
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Medicines</p>
              <button type="button" onClick={addMed} className="flex items-center gap-1 text-xs text-[#0A3D91] hover:text-blue-700 font-medium">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Medicine
              </button>
            </div>
            <div className="space-y-3">
              {form.medicines.map((med, idx) => (
                <MedicineRow key={idx} med={med} idx={idx} onChange={updateMed} onRemove={removeMed} canRemove={form.medicines.length > 1} />
              ))}
            </div>
          </section>

          <section>
            <Textarea label="Notes" placeholder="Any special instructions or remarks…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </section>

          {validationError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{validationError}</p>
          )}

          <div className="flex gap-3 pt-2 pb-4">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#D1DCF0] text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#0A3D91] text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              )}
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Schedule & Generate Tasks'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail Modal — full patient view + workflow actions ───────────────────

function DetailModal({ s, staffMap, advancing, onAdvance, onEdit, onCancel, onPause, onResume, onClose, isAdmin, canManage }) {
  const medicines = Array.isArray(s.medicines) ? s.medicines : []
  const salesName = staffMap[s.assigned_sales_staff_id] ?? '—'
  const purchaseName = staffMap[s.assigned_purchase_staff_id] ?? '—'
  const nextActions = NEXT_ACTIONS[s.workflow_status] ?? []
  const pipelineStage = getPipelineStage(s.workflow_status)
  const isCancelled = s.scheduler_status === 'cancelled' || s.workflow_status === 'cancelled'
  const isDone = s.workflow_status === 'delivered'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh] rounded-t-2xl">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#EEF3FB] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-800 leading-tight">{s.patient_name}</h2>
              <Badge cfg={PRIORITY_CFG} value={s.priority} />
              <Badge cfg={SCHEDULER_CFG} value={s.scheduler_status} />
            </div>
            {s.token_id && (
              <p className="mt-1 text-[11px] font-mono text-[#0A3D91] font-semibold tracking-widest bg-blue-50 inline-block px-2 py-0.5 rounded">
                {s.token_id}
              </p>
            )}
            {s.patient_mobile && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {s.patient_mobile}{s.patient_whatsapp && s.patient_whatsapp !== s.patient_mobile ? ` · WA: ${s.patient_whatsapp}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* 4-stage pipeline progress */}
          {!isCancelled && (
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-0">
                {PIPELINE.map((stage, i) => {
                  const done = pipelineStage > i
                  const current = pipelineStage === i
                  const last = i === PIPELINE.length - 1
                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                          done    ? 'bg-emerald-500 border-emerald-500 text-white' :
                          current ? 'bg-[#0A3D91] border-[#0A3D91] text-white' :
                                    'bg-white border-slate-200 text-slate-400'
                        }`}>
                          {done ? (
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : i + 1}
                        </div>
                        <span className={`text-[10px] font-medium mt-1 ${current ? 'text-[#0A3D91]' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {stage.label}
                        </span>
                      </div>
                      {!last && (
                        <div className={`h-0.5 flex-1 mx-1 rounded transition-all ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Current status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Current Status</span>
            <Badge cfg={WORKFLOW_CFG} value={s.workflow_status} />
          </div>

          {/* Workflow action buttons */}
          {!isCancelled && !isDone && nextActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What to do now</p>
              <div className={`grid gap-2 ${nextActions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {nextActions.map((action) => (
                  <button
                    key={action.to}
                    disabled={advancing}
                    onClick={() => onAdvance(s, action.to)}
                    className={`py-3 px-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${ACTION_BTN_CLS[action.color]}`}
                  >
                    {advancing && (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    )}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDone && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-emerald-700">Delivered — Cycle Complete</p>
            </div>
          )}

          {isCancelled && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <p className="text-sm text-slate-500">This schedule has been cancelled.</p>
            </div>
          )}

          {/* Refill details row */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-slate-400 font-medium mb-0.5">Next Refill</p>
              <p className="text-slate-800 font-semibold">{fmt(s.next_refill_date)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-slate-400 font-medium mb-0.5">Delivery</p>
              <p className="text-slate-800 font-semibold">{DELIVERY_LABELS[s.delivery_mode] ?? s.delivery_mode ?? '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-slate-400 font-medium mb-0.5">Sales Staff</p>
              <p className="text-slate-800 font-semibold truncate">{salesName}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-slate-400 font-medium mb-0.5">Purchase Staff</p>
              <p className="text-slate-800 font-semibold truncate">{purchaseName}</p>
            </div>
          </div>

          {/* Medicines list */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Medicines to Check ({medicines.length})
            </p>
            {medicines.length === 0 ? (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">No medicines saved — please edit this schedule.</p>
            ) : (
              <div className="space-y-1.5">
                {medicines.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-blue-50/60 border border-[#D1DCF0] rounded-xl px-3 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#0A3D91] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{m.medicine_name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {[
                          m.strength && `Strength: ${m.strength}`,
                          `Qty: ${m.quantity_required || 1}`,
                          m.preferred_brand && `Brand: ${m.preferred_brand}`,
                          m.substitute_allowed && 'Substitute OK',
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {s.notes && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Notes</p>
              <p className="text-xs text-slate-700">{s.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-[#EEF3FB] shrink-0 space-y-2">
          {/* Admin/Manager: pause·resume + edit */}
          {canManage && !isCancelled && (
            <div className="flex gap-2">
              {s.scheduler_status === 'paused' ? (
                <button onClick={() => { onResume(s); onClose() }}
                  className="flex-1 py-2 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Resume Schedule
                </button>
              ) : (
                <button onClick={() => { onPause(s); onClose() }}
                  className="flex-1 py-2 rounded-xl border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Pause Schedule
                </button>
              )}
              <button onClick={() => { onEdit(s); onClose() }}
                className="flex-1 py-2 rounded-xl border border-[#D1DCF0] text-xs font-semibold text-[#0A3D91] hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Details
              </button>
            </div>
          )}

          {/* Admin only: cancel schedule */}
          {isAdmin && !isCancelled && (
            <button onClick={() => { onCancel(s); onClose() }}
              className="w-full py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Cancel Schedule (Admin Only)
            </button>
          )}

          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cancel confirm modal ──────────────────────────────────────────────────

function ConfirmModal({ patient, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Cancel Schedule?</p>
            <p className="text-sm text-slate-500">{patient}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          This will soft-cancel the schedule. The record is kept but no future tasks will be generated.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg border border-[#D1DCF0] text-sm text-slate-600 hover:bg-slate-50 transition-colors">Keep It</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Cancel Schedule</button>
        </div>
      </div>
    </div>
  )
}

// ── Schedule Card (summary tile — click to open detail) ───────────────────

function ScheduleCard({ s, staffMap, onOpenDetail, isAdmin, canManage }) {
  const medicines = Array.isArray(s.medicines) ? s.medicines : []
  const medNames = medicines.slice(0, 2).map((m) => m.medicine_name).filter(Boolean)
  const extra = medicines.length - 2
  const isCancelled = s.scheduler_status === 'cancelled'
  const wfCfg = WORKFLOW_CFG[s.workflow_status]

  return (
    <div
      onClick={() => onOpenDetail(s)}
      className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md cursor-pointer group ${isCancelled ? 'opacity-60 border-slate-200' : 'border-[#D1DCF0] hover:border-[#0A3D91]/30'}`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#EEF3FB]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight">{s.patient_name}</p>
            {s.patient_mobile && (
              <p className="text-[11px] text-slate-400 mt-0.5">{s.patient_mobile}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <Badge cfg={PRIORITY_CFG} value={s.priority} />
            <Badge cfg={SCHEDULER_CFG} value={s.scheduler_status} />
          </div>
        </div>
        {s.token_id && (
          <div className="mt-2 inline-flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-md px-2 py-0.5">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#0A3D91] shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            <span className="text-[11px] font-mono font-semibold text-[#0A3D91] tracking-wide">{s.token_id}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5 text-xs">
        {/* Next refill + workflow status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 font-medium text-[11px]">Next Refill</p>
            <p className="text-slate-800 font-bold mt-0.5">{fmt(s.next_refill_date)}</p>
          </div>
          {wfCfg && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${wfCfg.cls}`}>{wfCfg.label}</span>
          )}
        </div>

        {/* Medicines */}
        <div>
          <p className="text-slate-400 font-medium text-[11px] mb-1">
            Medicines {medicines.length > 0 ? `(${medicines.length})` : <span className="text-red-500">— MISSING</span>}
          </p>
          {medNames.length > 0 ? (
            <p className="text-slate-700 font-medium leading-snug">
              {medNames.join(', ')}
              {extra > 0 && <span className="text-slate-400"> +{extra} more</span>}
            </p>
          ) : (
            <p className="text-red-500 font-medium">No medicines — tap to fix</p>
          )}
        </div>
      </div>

      {/* Tap indicator */}
      <div className="px-4 pb-3 flex items-center justify-end">
        <span className="text-[11px] text-slate-400 group-hover:text-[#0A3D91] transition-colors flex items-center gap-0.5 font-medium">
          View details
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PatientRefillCenter() {
  const { user } = useAuth()
  const { toasts, add: showToast, remove: removeToast } = useToast()
  const [schedules, setSchedules] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [advancingId, setAdvancingId] = useState(null)

  const effectiveRole = getEffectiveRole(user)
  const isAdmin = effectiveRole === 'admin'
  const canManage = isAdmin || effectiveRole === 'decision_manager' || effectiveRole === 'sales_manager'
  const canCreate = canManage

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [clientRequestId, setClientRequestId] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('next_7')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sched, staffList] = await Promise.all([getAllRefillSchedules(), getStaff()])
      setSchedules(Array.isArray(sched) ? sched : sched.data ?? [])
      setStaff(Array.isArray(staffList) ? staffList : staffList.data ?? [])
    } catch (err) {
      showToast('Failed to load schedules: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const staffMap = useMemo(() => {
    const m = {}
    staff.forEach((s) => { m[s.id] = s.name })
    return m
  }, [staff])

  const filtered = useMemo(() => {
    let list = schedules
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.patient_name?.toLowerCase().includes(q) || s.patient_mobile?.includes(q) || s.token_id?.includes(q.toUpperCase()))
    }
    if (filterStatus) list = list.filter((s) => s.scheduler_status === filterStatus)
    if (filterWorkflow) list = list.filter((s) => s.workflow_status === filterWorkflow)
    if (filterPriority) list = list.filter((s) => s.priority === filterPriority)
    list = applyDateFilter(list, dateFilter)
    return list
  }, [schedules, search, filterStatus, filterWorkflow, filterPriority, dateFilter])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSave = async (form) => {
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        assignedSalesStaffId: form.assignedSalesStaffId || null,
        assignedPurchaseStaffId: form.assignedPurchaseStaffId || null,
        customIntervalDays: form.customIntervalDays ? +form.customIntervalDays : null,
        medicines: form.medicines.filter((m) => (m.medicineName || '').trim()),
        clientRequestId: editTarget ? undefined : clientRequestId,
      }
      if (editTarget) {
        await updateRefillSchedule(editTarget.id, payload)
        showToast('Schedule updated successfully.', 'success')
      } else {
        const result = await addRefillSchedule(payload)
        const token = result?.token_id ?? ''
        const taskCount = result?._workflowTasks?.created ?? 0
        const parts = ['Refill schedule created successfully.']
        if (token) parts.push(`Token: ${token}`)
        if (taskCount) parts.push(`${taskCount} tasks generated`)
        showToast(parts.join(' · '), 'success')
      }
      setShowForm(false)
      setEditTarget(null)
      setClientRequestId('')
      await load()
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (s) => { setEditTarget(s); setShowForm(true) }

  const handlePause = async (s) => {
    try {
      await pauseRefillSchedule(s.id)
      showToast(`${s.patient_name} paused.`, 'success')
      await load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleResume = async (s) => {
    try {
      await resumeRefillSchedule(s.id)
      showToast(`${s.patient_name} resumed.`, 'success')
      await load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return
    try {
      await deleteRefillSchedule(cancelTarget.id)
      showToast(`${cancelTarget.patient_name} cancelled.`, 'success')
      setCancelTarget(null)
      await load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleAdvanceWorkflow = async (s, nextStatus) => {
    setAdvancingId(s.id)
    try {
      await updateWorkflowStatus(s.id, nextStatus)
      const cfg = WORKFLOW_CFG[nextStatus]
      showToast(`${s.patient_name} → ${cfg?.label ?? nextStatus}`, 'success')
      // Refresh the detail target if it's the same schedule
      setDetailTarget(null)
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setAdvancingId(null)
    }
  }

  const openAdd = () => {
    setEditTarget(null)
    const rid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setClientRequestId(rid)
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditTarget(null); setClientRequestId('') }

  const editInitial = editTarget ? {
    patientName: editTarget.patient_name ?? '',
    patientMobile: editTarget.patient_mobile ?? '',
    patientWhatsapp: editTarget.patient_whatsapp ?? '',
    patientEmail: editTarget.patient_email ?? '',
    patientAddress: editTarget.patient_address ?? '',
    patientType: editTarget.patient_type ?? 'regular',
    refillDate: editTarget.refill_date ?? '',
    refillFrequency: editTarget.refill_frequency ?? 'monthly',
    customIntervalDays: editTarget.custom_interval_days ?? '',
    nextRefillDate: editTarget.next_refill_date ?? '',
    assignedSalesStaffId: editTarget.assigned_sales_staff_id ?? '',
    assignedPurchaseStaffId: editTarget.assigned_purchase_staff_id ?? '',
    deliveryMode: editTarget.delivery_mode ?? 'pickup',
    priority: editTarget.priority ?? 'medium',
    schedulerStatus: editTarget.scheduler_status ?? 'active',
    workflowStatus: editTarget.workflow_status ?? 'upcoming',
    startReminderDaysBefore: editTarget.start_reminder_days_before ?? 3,
    notes: editTarget.notes ?? '',
    medicines: Array.isArray(editTarget.medicines) && editTarget.medicines.length
      ? editTarget.medicines.map((m) => ({
          medicineName: m.medicine_name ?? '',
          strength: m.strength ?? '',
          quantityRequired: m.quantity_required ?? 1,
          preferredBrand: m.preferred_brand ?? '',
          substituteAllowed: !!m.substitute_allowed,
          notes: m.notes ?? '',
        }))
      : [{ medicineName: '', strength: '', quantityRequired: 1, preferredBrand: '', substituteAllowed: false, notes: '' }],
  } : null

  const stats = useMemo(() => ({
    total: schedules.length,
    active: schedules.filter((s) => s.scheduler_status === 'active').length,
    paused: schedules.filter((s) => s.scheduler_status === 'paused').length,
    dueToday: schedules.filter((s) => s.next_refill_date === today()).length,
  }), [schedules])

  return (
    <div className="min-h-full bg-[#F4F7FD]">
      <Toast toasts={toasts} remove={removeToast} />

      {/* Modals */}
      {showForm && (
        <ScheduleForm initial={editInitial} staff={staff} onSave={handleSave} onClose={closeForm} saving={saving} />
      )}
      {cancelTarget && (
        <ConfirmModal patient={cancelTarget.patient_name} onConfirm={handleCancelConfirm} onCancel={() => setCancelTarget(null)} />
      )}
      {detailTarget && (
        <DetailModal
          s={detailTarget}
          staffMap={staffMap}
          advancing={advancingId === detailTarget.id}
          onAdvance={handleAdvanceWorkflow}
          onEdit={handleEdit}
          onCancel={(s) => setCancelTarget(s)}
          onPause={handlePause}
          onResume={handleResume}
          onClose={() => setDetailTarget(null)}
          isAdmin={isAdmin}
          canManage={canManage}
        />
      )}

      {/* Page header */}
      <div className="bg-white border-b border-[#D1DCF0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-[#D1DCF0] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0A3D91]" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Patient Refill Center</h1>
              <p className="text-xs text-slate-500">Click any card to view details and take action</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A3D91] text-white text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Schedule
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: stats.total,    color: 'text-slate-700' },
            { label: 'Active',    value: stats.active,   color: 'text-emerald-600' },
            { label: 'Paused',    value: stats.paused,   color: 'text-amber-600' },
            { label: 'Due Today', value: stats.dueToday, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#D1DCF0] px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Date filter pills */}
        <div className="flex gap-2 flex-wrap">
          {DATE_FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                dateFilter === key
                  ? 'bg-[#0A3D91] text-white border-[#0A3D91] shadow-sm'
                  : 'bg-white text-slate-600 border-[#D1DCF0] hover:border-[#0A3D91] hover:text-[#0A3D91]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#D1DCF0] p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input type="text" placeholder="Search patient, mobile, or token…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#D1DCF0] rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91]" />
            </div>
            <Select value={filterStatus} onChange={setFilterStatus} options={SCHEDULER_STATUSES.map((s) => ({ value: s, label: SCHEDULER_CFG[s]?.label ?? s }))} placeholder="Status: All" />
            <Select value={filterWorkflow} onChange={setFilterWorkflow} options={Object.entries(WORKFLOW_CFG).map(([v, c]) => ({ value: v, label: c.label }))} placeholder="Workflow: All" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-full sm:max-w-xs">
              <Select value={filterPriority} onChange={setFilterPriority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_CFG[p]?.label ?? p }))} placeholder="Priority: All" />
            </div>
            {(search || filterStatus || filterWorkflow || filterPriority) && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterWorkflow(''); setFilterPriority('') }}
                className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1 whitespace-nowrap">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-slate-500">
          {loading ? 'Loading…' : `${filtered.length} schedule${filtered.length !== 1 ? 's' : ''} found`}
        </p>

        {/* Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="w-6 h-6 animate-spin text-[#0A3D91]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-[#D1DCF0] flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No schedules found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or add a new schedule.</p>
            {canCreate && (
              <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-xl bg-[#0A3D91] text-white text-sm font-semibold hover:bg-blue-800 transition-colors">
                Add First Schedule
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((s) => (
              <ScheduleCard
                key={s.id}
                s={s}
                staffMap={staffMap}
                onOpenDetail={setDetailTarget}
                isAdmin={isAdmin}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
