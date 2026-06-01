import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import {
  getAllRefillSchedules,
  addRefillSchedule,
  updateRefillSchedule,
  pauseRefillSchedule,
  resumeRefillSchedule,
  deleteRefillSchedule,
} from '../services/refillSchedules'
import { getStaff } from '../services/api'

// ── Constants ─────────────────────────────────────────────────────────────

const DELIVERY_MODES = ['pickup', 'home_delivery', 'courier', 'online']
const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly', 'bimonthly', 'quarterly', 'custom']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const WORKFLOW_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled']
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
  pending:     { label: 'Pending',     cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const SCHEDULER_CFG = {
  active:    { label: 'Active',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  paused:    { label: 'Paused',    cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const DELIVERY_LABELS = {
  pickup: 'Pickup', home_delivery: 'Home Delivery', courier: 'Courier', online: 'Online',
}

const DEFAULT_FORM = {
  patientName: '', patientMobile: '', patientWhatsapp: '', patientEmail: '',
  patientAddress: '', patientType: 'regular',
  refillDate: '', refillFrequency: 'monthly', customIntervalDays: '',
  nextRefillDate: '',
  assignedSalesStaffId: '', assignedPurchaseStaffId: '',
  deliveryMode: 'pickup', priority: 'medium',
  schedulerStatus: 'active', workflowStatus: 'pending',
  startReminderDaysBefore: 3, notes: '',
  medicines: [{ medicineName: '', strength: '', quantityRequired: 1, preferredBrand: '', substituteAllowed: false, notes: '' }],
}

// ── Date helpers ──────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }
function addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function startOfWeek() {
  const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d.toISOString().slice(0, 10)
}
function endOfWeek() {
  const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day))
  return d.toISOString().slice(0, 10)
}
function startOfMonth() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}
function endOfMonth() {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0)
  return d.toISOString().slice(0, 10)
}

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

function Pill({ label, cls }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{label}</span>
}

function Select({ label, value, onChange, options, placeholder = 'All' }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-[#D1DCF0] rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </div>
  )
}

function Input({ label, required, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        {...props}
        className="w-full text-sm border border-[#D1DCF0] rounded-lg px-3 py-2 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91]"
      />
    </div>
  )
}

function Textarea({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <textarea
        {...props}
        rows={3}
        className="w-full text-sm border border-[#D1DCF0] rounded-lg px-3 py-2 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91] resize-none"
      />
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────

function ConfirmModal({ patient, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg border border-[#D1DCF0] text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Keep It
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
            Cancel Schedule
          </button>
        </div>
      </div>
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

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  const updateMed = (idx, val) => setForm((f) => {
    const meds = [...f.medicines]; meds[idx] = val; return { ...f, medicines: meds }
  })
  const addMed = () => setForm((f) => ({
    ...f,
    medicines: [...f.medicines, { medicineName: '', strength: '', quantityRequired: 1, preferredBrand: '', substituteAllowed: false, notes: '' }],
  }))
  const removeMed = (idx) => setForm((f) => ({
    ...f, medicines: f.medicines.filter((_, i) => i !== idx),
  }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.patientName.trim()) return
    onSave(form)
  }

  const salesStaff = staff.filter((s) => s.department === 'Sales' || !s.department)
  const purchaseStaff = staff.filter((s) => s.department === 'Purchase' || !s.department)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-white h-full w-full max-w-xl shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
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
          {/* Patient details */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Patient Details</p>
            <div className="space-y-3">
              <Input label="Patient Name" required placeholder="Full name" value={form.patientName} onChange={(e) => set('patientName', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Mobile" placeholder="10-digit number" value={form.patientMobile} onChange={(e) => set('patientMobile', e.target.value)} />
                <Input label="WhatsApp" placeholder="If different" value={form.patientWhatsapp} onChange={(e) => set('patientWhatsapp', e.target.value)} />
              </div>
              <Input label="Email" type="email" placeholder="Optional" value={form.patientEmail} onChange={(e) => set('patientEmail', e.target.value)} />
              <Textarea label="Address" placeholder="Delivery address" value={form.patientAddress} onChange={(e) => set('patientAddress', e.target.value)} />
              <Select label="Patient Type" value={form.patientType} onChange={(v) => set('patientType', v)}
                options={PATIENT_TYPES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                placeholder="" />
            </div>
          </section>

          {/* Refill schedule */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Refill Schedule</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Refill / Start Date" required type="date" value={form.refillDate} onChange={(e) => set('refillDate', e.target.value)} />
                <Input label="Next Refill Date" type="date" value={form.nextRefillDate} onChange={(e) => set('nextRefillDate', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Frequency" value={form.refillFrequency} onChange={(v) => set('refillFrequency', v)}
                  placeholder=""
                  options={FREQUENCIES.map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))} />
                {form.refillFrequency === 'custom' && (
                  <Input label="Interval (days)" type="number" min={1} value={form.customIntervalDays}
                    onChange={(e) => set('customIntervalDays', e.target.value)} placeholder="e.g. 45" />
                )}
              </div>
              <Input label="Reminder Days Before" type="number" min={0} max={14} value={form.startReminderDaysBefore}
                onChange={(e) => set('startReminderDaysBefore', +e.target.value)} />
            </div>
          </section>

          {/* Assignment */}
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
                <Select label="Delivery Mode" value={form.deliveryMode} onChange={(v) => set('deliveryMode', v)}
                  placeholder=""
                  options={DELIVERY_MODES.map((d) => ({ value: d, label: DELIVERY_LABELS[d] ?? d }))} />
                <Select label="Priority" value={form.priority} onChange={(v) => set('priority', v)}
                  placeholder=""
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_CFG[p]?.label ?? p }))} />
              </div>
            </div>
          </section>

          {/* Status (edit only) */}
          {initial && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Status</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Scheduler Status" value={form.schedulerStatus} onChange={(v) => set('schedulerStatus', v)}
                  placeholder=""
                  options={SCHEDULER_STATUSES.map((s) => ({ value: s, label: SCHEDULER_CFG[s]?.label ?? s }))} />
                <Select label="Workflow Status" value={form.workflowStatus} onChange={(v) => set('workflowStatus', v)}
                  placeholder=""
                  options={WORKFLOW_STATUSES.map((s) => ({ value: s, label: WORKFLOW_CFG[s]?.label ?? s }))} />
              </div>
            </section>
          )}

          {/* Medicines */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Medicines</p>
              <button type="button" onClick={addMed}
                className="flex items-center gap-1 text-xs text-[#0A3D91] hover:text-blue-700 font-medium">
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

          {/* Notes */}
          <section>
            <Textarea label="Notes" placeholder="Any special instructions or remarks…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </section>

          {/* Footer */}
          <div className="flex gap-3 pt-2 pb-4">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#D1DCF0] text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#0A3D91] text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              )}
              {initial ? 'Save Changes' : 'Add Schedule & Generate Tasks'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Schedule Card ──────────────────────────────────────────────────────────

function ScheduleCard({ s, staffMap, onEdit, onPause, onResume, onCancel }) {
  const salesName = staffMap[s.assigned_sales_staff_id] ?? '—'
  const purchaseName = staffMap[s.assigned_purchase_staff_id] ?? '—'
  const medCount = Array.isArray(s.medicines) ? s.medicines.length : 0
  const isCancelled = s.scheduler_status === 'cancelled'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${isCancelled ? 'opacity-60 border-slate-200' : 'border-[#D1DCF0]'}`}>
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[#EEF3FB]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm leading-tight truncate max-w-[180px]">{s.patient_name}</p>
            <Badge cfg={PRIORITY_CFG} value={s.priority} />
          </div>
          {s.patient_mobile && (
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {s.patient_mobile}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <Badge cfg={SCHEDULER_CFG} value={s.scheduler_status} />
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <div>
          <p className="text-slate-400 font-medium mb-0.5">Next Refill</p>
          <p className="text-slate-700 font-semibold">{fmt(s.next_refill_date)}</p>
        </div>
        <div>
          <p className="text-slate-400 font-medium mb-0.5">Medicines</p>
          <p className="text-slate-700 font-semibold">{medCount} item{medCount !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p className="text-slate-400 font-medium mb-0.5">Sales Staff</p>
          <p className="text-slate-700 truncate">{salesName}</p>
        </div>
        <div>
          <p className="text-slate-400 font-medium mb-0.5">Purchase Staff</p>
          <p className="text-slate-700 truncate">{purchaseName}</p>
        </div>
        <div>
          <p className="text-slate-400 font-medium mb-0.5">Delivery</p>
          <p className="text-slate-700">{DELIVERY_LABELS[s.delivery_mode] ?? s.delivery_mode ?? '—'}</p>
        </div>
        <div>
          <p className="text-slate-400 font-medium mb-0.5">Workflow</p>
          <Badge cfg={WORKFLOW_CFG} value={s.workflow_status} />
        </div>
      </div>

      {/* Task progress (if tasks generated) */}
      {s._taskProgress != null && (
        <div className="px-4 py-2 bg-blue-50/40 border-t border-[#EEF3FB]">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Task Progress</span>
            <span>{s._taskProgress.done}/{s._taskProgress.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0A3D91] to-teal-500 transition-all"
              style={{ width: s._taskProgress.total ? `${(s._taskProgress.done / s._taskProgress.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {!isCancelled && (
        <div className="flex border-t border-[#EEF3FB]">
          <button onClick={() => onEdit(s)}
            className="flex-1 py-2.5 text-xs font-medium text-[#0A3D91] hover:bg-blue-50 transition-colors rounded-bl-2xl flex items-center justify-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <div className="w-px bg-[#EEF3FB]" />
          {s.scheduler_status === 'paused' ? (
            <button onClick={() => onResume(s)}
              className="flex-1 py-2.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </button>
          ) : (
            <button onClick={() => onPause(s)}
              className="flex-1 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </button>
          )}
          <div className="w-px bg-[#EEF3FB]" />
          <button onClick={() => onCancel(s)}
            className="flex-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors rounded-br-2xl flex items-center justify-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PatientRefillCenter() {
  const { toasts, showToast, removeToast } = useToast()
  const [schedules, setSchedules] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('next_7')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')
  const [filterDelivery, setFilterDelivery] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStaff, setFilterStaff] = useState('')

  // Load data
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
  }, [])

  useEffect(() => { load() }, [load])

  const staffMap = useMemo(() => {
    const m = {}
    staff.forEach((s) => { m[s.id] = s.name })
    return m
  }, [staff])

  // Filtered list
  const filtered = useMemo(() => {
    let list = schedules
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        s.patient_name?.toLowerCase().includes(q) ||
        s.patient_mobile?.includes(q)
      )
    }
    if (filterStatus) list = list.filter((s) => s.scheduler_status === filterStatus)
    if (filterWorkflow) list = list.filter((s) => s.workflow_status === filterWorkflow)
    if (filterDelivery) list = list.filter((s) => s.delivery_mode === filterDelivery)
    if (filterPriority) list = list.filter((s) => s.priority === filterPriority)
    if (filterStaff) list = list.filter((s) => s.assigned_sales_staff_id == filterStaff || s.assigned_purchase_staff_id == filterStaff)
    list = applyDateFilter(list, dateFilter)
    return list
  }, [schedules, search, filterStatus, filterWorkflow, filterDelivery, filterPriority, filterStaff, dateFilter])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSave = async (form) => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        assignedSalesStaffId: form.assignedSalesStaffId || null,
        assignedPurchaseStaffId: form.assignedPurchaseStaffId || null,
        customIntervalDays: form.customIntervalDays ? +form.customIntervalDays : null,
        medicines: form.medicines.filter((m) => m.medicineName.trim()),
      }
      if (editTarget) {
        await updateRefillSchedule(editTarget.id, payload)
        showToast('Schedule updated.', 'success')
      } else {
        const result = await addRefillSchedule(payload)
        const taskCount = result?._workflowTasks?.tasksCreated ?? 0
        showToast(`Schedule added${taskCount ? ` · ${taskCount} tasks generated` : ''}.`, 'success')
      }
      setShowForm(false)
      setEditTarget(null)
      await load()
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (s) => {
    setEditTarget(s)
    setShowForm(true)
  }

  const handlePause = async (s) => {
    try {
      await pauseRefillSchedule(s.id)
      showToast(`${s.patient_name} paused.`, 'success')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleResume = async (s) => {
    try {
      await resumeRefillSchedule(s.id)
      showToast(`${s.patient_name} resumed.`, 'success')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return
    try {
      await deleteRefillSchedule(cancelTarget.id)
      showToast(`${cancelTarget.patient_name} cancelled.`, 'success')
      setCancelTarget(null)
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const openAdd = () => { setEditTarget(null); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditTarget(null) }

  // Build initial form values for edit
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
    workflowStatus: editTarget.workflow_status ?? 'pending',
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

  // Stats
  const stats = useMemo(() => ({
    total: schedules.length,
    active: schedules.filter((s) => s.scheduler_status === 'active').length,
    paused: schedules.filter((s) => s.scheduler_status === 'paused').length,
    dueToday: schedules.filter((s) => s.next_refill_date === today()).length,
  }), [schedules])

  return (
    <div className="min-h-full bg-[#F4F7FD]">
      {/* Toast */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => <Toast key={t.id} toast={t} onRemove={removeToast} />)}
      </div>

      {/* Modals */}
      {showForm && (
        <ScheduleForm
          initial={editInitial}
          staff={staff}
          onSave={handleSave}
          onClose={closeForm}
          saving={saving}
        />
      )}
      {cancelTarget && (
        <ConfirmModal
          patient={cancelTarget.patient_name}
          onConfirm={handleCancelConfirm}
          onCancel={() => setCancelTarget(null)}
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
              <p className="text-xs text-slate-500">Manage refill schedules and workflow tasks</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A3D91] text-white text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Schedule
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700' },
            { label: 'Active', value: stats.active, color: 'text-emerald-600' },
            { label: 'Paused', value: stats.paused, color: 'text-amber-600' },
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
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                dateFilter === key
                  ? 'bg-[#0A3D91] text-white border-[#0A3D91] shadow-sm'
                  : 'bg-white text-slate-600 border-[#D1DCF0] hover:border-[#0A3D91] hover:text-[#0A3D91]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="bg-white rounded-xl border border-[#D1DCF0] p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="xl:col-span-2 relative">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search patient name or mobile…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#D1DCF0] rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#0A3D91]"
              />
            </div>

            <Select value={filterStatus} onChange={setFilterStatus}
              options={SCHEDULER_STATUSES.map((s) => ({ value: s, label: SCHEDULER_CFG[s]?.label ?? s }))}
              placeholder="Status: All" />

            <Select value={filterWorkflow} onChange={setFilterWorkflow}
              options={WORKFLOW_STATUSES.map((s) => ({ value: s, label: WORKFLOW_CFG[s]?.label ?? s }))}
              placeholder="Workflow: All" />

            <Select value={filterDelivery} onChange={setFilterDelivery}
              options={DELIVERY_MODES.map((d) => ({ value: d, label: DELIVERY_LABELS[d] ?? d }))}
              placeholder="Delivery: All" />

            <Select value={filterPriority} onChange={setFilterPriority}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_CFG[p]?.label ?? p }))}
              placeholder="Priority: All" />
          </div>

          {/* Staff filter (full width) */}
          <div className="mt-3 flex items-center gap-3">
            <div className="w-full sm:max-w-xs">
              <Select value={filterStaff} onChange={setFilterStaff}
                options={staff.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Staff: All" />
            </div>
            {(search || filterStatus || filterWorkflow || filterDelivery || filterPriority || filterStaff) && (
              <button
                onClick={() => { setSearch(''); setFilterStatus(''); setFilterWorkflow(''); setFilterDelivery(''); setFilterPriority(''); setFilterStaff('') }}
                className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} schedule${filtered.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Grid / Empty */}
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
            <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-xl bg-[#0A3D91] text-white text-sm font-semibold hover:bg-blue-800 transition-colors">
              Add First Schedule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((s) => (
              <ScheduleCard
                key={s.id}
                s={s}
                staffMap={staffMap}
                onEdit={handleEdit}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={(s) => setCancelTarget(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
