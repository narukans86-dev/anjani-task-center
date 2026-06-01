import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { createAuditLog } from '../services/api'
import { hasRole } from '../services/permissions'

const STORAGE_KEY = 'anjani_quote_templates'

const DEFAULT_TEMPLATE = {
  id: 'default',
  templateName: 'Anjani Medical Standard Quote',
  quoteTitle: 'Quotation',
  headerText: 'Anjani Medical — Your Trusted Health Partner',
  customerGreeting: 'Dear Valued Customer,',
  bodyText:
    'We are pleased to provide you with the following quotation for your medical requirements. Please review the items listed below and feel free to contact us for any clarifications.',
  termsAndConditions:
    '1. Prices are valid for the validity period mentioned.\n2. GST applicable as per government norms.\n3. Delivery charges extra if applicable.\n4. Returns accepted only for damaged/defective products.\n5. Payment terms as agreed.',
  footerText: 'Thank you for choosing Anjani Medical. We look forward to serving you.',
  validityDays: 7,
  defaultDiscountText: 'Discount as applicable on selected items',
  paymentNote: 'Payment accepted via Cash, UPI, NEFT/RTGS',
  deliveryNote: 'Delivery within 1-2 working days (subject to stock availability)',
  contactPhone: '',
  contactEmail: '',
  showLogo: true,
  isActive: true,
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [{ ...DEFAULT_TEMPLATE }]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : [{ ...DEFAULT_TEMPLATE }]
  } catch {
    return [{ ...DEFAULT_TEMPLATE }]
  }
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

function generateId() {
  return `qt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const EMPTY_FORM = {
  templateName: '',
  quoteTitle: 'Quotation',
  headerText: '',
  customerGreeting: 'Dear Valued Customer,',
  bodyText: '',
  termsAndConditions: '',
  footerText: '',
  validityDays: 7,
  defaultDiscountText: '',
  paymentNote: '',
  deliveryNote: '',
  contactPhone: '',
  contactEmail: '',
  showLogo: true,
  isActive: true,
}

export default function QuoteEditor() {
  const { user } = useAuth()
  const isAdmin = hasRole(user, ['admin'])
  const canEdit = isAdmin
  const canView = hasRole(user, ['admin', 'manager'])

  const [templates, setTemplates] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [toast, setToast] = useState(null)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    const loaded = loadTemplates()
    setTemplates(loaded)
    const def = loaded.find((t) => t.isDefault) ?? loaded[0]
    if (def) {
      setSelectedId(def.id)
      setForm(def)
    }
  }, [])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  function selectTemplate(id) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setSelectedId(id)
    setForm(t)
    setDirty(false)
    setIsNew(false)
    setShowPreview(false)
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  function handleSave() {
    if (!form.templateName.trim()) {
      showToast('Template name is required', 'error')
      return
    }
    const now = new Date().toISOString()
    let updated
    if (isNew) {
      const newT = { ...form, id: generateId(), createdAt: now, updatedAt: now }
      updated = [...templates, newT]
      setSelectedId(newT.id)
      createAuditLog({
        action: 'quote_template_created',
        entity_type: 'quote_template',
        entity_id: newT.id,
        user_name: user?.name,
        details: `Quote template '${newT.templateName}' created`,
      }).catch(() => {})
    } else {
      updated = templates.map((t) =>
        t.id === selectedId ? { ...form, id: selectedId, updatedAt: now } : t
      )
      createAuditLog({
        action: 'quote_template_edited',
        entity_type: 'quote_template',
        entity_id: selectedId,
        user_name: user?.name,
        details: `Quote template '${form.templateName}' updated`,
      }).catch(() => {})
    }
    saveTemplates(updated)
    setTemplates(updated)
    setDirty(false)
    setIsNew(false)
    showToast('Template saved successfully')
  }

  function handleCancel() {
    if (isNew) {
      const def = templates.find((t) => t.isDefault) ?? templates[0]
      if (def) {
        setSelectedId(def.id)
        setForm(def)
      }
      setIsNew(false)
    } else {
      const original = templates.find((t) => t.id === selectedId)
      if (original) setForm(original)
    }
    setDirty(false)
  }

  function handleNew() {
    setIsNew(true)
    setSelectedId(null)
    setForm({ ...EMPTY_FORM })
    setDirty(false)
  }

  function handleDuplicate() {
    const now = new Date().toISOString()
    const newT = {
      ...form,
      id: generateId(),
      templateName: `${form.templateName} (Copy)`,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    }
    const updated = [...templates, newT]
    saveTemplates(updated)
    setTemplates(updated)
    setSelectedId(newT.id)
    setForm(newT)
    setDirty(false)
    setIsNew(false)
    createAuditLog({
      action: 'quote_template_created',
      entity_type: 'quote_template',
      entity_id: newT.id,
      user_name: user?.name,
      details: `Quote template '${newT.templateName}' duplicated from '${form.templateName}'`,
    }).catch(() => {})
    showToast('Template duplicated')
  }

  function handleSetDefault() {
    const updated = templates.map((t) => ({
      ...t,
      isDefault: t.id === selectedId,
    }))
    saveTemplates(updated)
    setTemplates(updated)
    createAuditLog({
      action: 'default_quote_template_changed',
      entity_type: 'quote_template',
      entity_id: selectedId,
      user_name: user?.name,
      details: `Default quote template changed to '${form.templateName}'`,
    }).catch(() => {})
    showToast('Set as default template')
  }

  function handleDelete() {
    if (templates.length === 1) {
      showToast('Cannot delete the only template', 'error')
      setDeleteConfirm(false)
      return
    }
    const updated = templates.filter((t) => t.id !== selectedId)
    // If we deleted the default, make first remaining the default
    if (!updated.some((t) => t.isDefault)) updated[0].isDefault = true
    saveTemplates(updated)
    createAuditLog({
      action: 'quote_template_deleted',
      entity_type: 'quote_template',
      entity_id: selectedId,
      user_name: user?.name,
      details: `Quote template '${form.templateName}' deleted`,
    }).catch(() => {})
    setTemplates(updated)
    const next = updated.find((t) => t.isDefault) ?? updated[0]
    setSelectedId(next.id)
    setForm(next)
    setDirty(false)
    setDeleteConfirm(false)
    showToast('Template deleted')
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You do not have permission to access this page.</p>
      </div>
    )
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId)
  const isDefaultSelected = selectedTemplate?.isDefault ?? false

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-[#D1DCF0] px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#0A3D91]">Quote Editor</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create and manage quotation templates for Anjani Medical
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#0A3D91] text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Template
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 p-4 lg:p-6">
        {/* Template list sidebar */}
        <div className="w-full lg:w-64 shrink-0 mb-4 lg:mb-0">
          <div className="bg-white rounded-xl border border-[#D1DCF0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#D1DCF0] bg-blue-50/40">
              <p className="text-xs font-semibold text-[#0A3D91] uppercase tracking-wide">Templates</p>
            </div>
            <div className="divide-y divide-[#D1DCF0]">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selectedId === t.id && !isNew
                      ? 'bg-blue-50 border-l-2 border-[#0A3D91]'
                      : 'hover:bg-slate-50 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium text-slate-800 leading-tight">{t.templateName}</p>
                    <div className="flex gap-1 shrink-0 mt-0.5">
                      {t.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-[#0A3D91] font-semibold">
                          Default
                        </span>
                      )}
                      {!t.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{t.quoteTitle}</p>
                </button>
              ))}
              {isNew && (
                <div className="px-4 py-3 bg-blue-50 border-l-2 border-[#0A3D91]">
                  <p className="text-sm font-medium text-[#0A3D91] italic">New template…</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main editor */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Action bar */}
          <div className="bg-white rounded-xl border border-[#D1DCF0] px-4 py-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[#D1DCF0] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>

            {canEdit && !isNew && selectedId && (
              <>
                <button
                  onClick={handleDuplicate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[#D1DCF0] text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Duplicate
                </button>

                {!isDefaultSelected && (
                  <button
                    onClick={handleSetDefault}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[#D1DCF0] text-[#0A3D91] hover:bg-blue-50 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Set as Default
                  </button>
                )}

                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors ml-auto"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="bg-white rounded-xl border border-[#D1DCF0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#D1DCF0] bg-blue-50/40 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#0A3D91]" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs font-semibold text-[#0A3D91] uppercase tracking-wide">Quotation Preview</p>
              </div>
              <div className="p-6 max-w-2xl mx-auto">
                <QuotePreview template={form} />
              </div>
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-xl border border-[#D1DCF0] divide-y divide-[#D1DCF0]">
            <Section title="Template Identity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Template Name *" required>
                  <input
                    type="text"
                    value={form.templateName}
                    onChange={(e) => handleChange('templateName', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. Anjani Medical Standard Quote"
                    className={inputCls(canEdit)}
                  />
                </Field>
                <Field label="Quote Title">
                  <input
                    type="text"
                    value={form.quoteTitle}
                    onChange={(e) => handleChange('quoteTitle', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. Quotation / Pro-forma Invoice"
                    className={inputCls(canEdit)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Field label="Status">
                  <div className="flex items-center gap-3 h-10">
                    <Toggle
                      value={form.isActive}
                      onChange={(v) => handleChange('isActive', v)}
                      disabled={!canEdit}
                      label={form.isActive ? 'Active' : 'Inactive'}
                    />
                  </div>
                </Field>
                <Field label="Show Logo">
                  <div className="flex items-center gap-3 h-10">
                    <Toggle
                      value={form.showLogo}
                      onChange={(v) => handleChange('showLogo', v)}
                      disabled={!canEdit}
                      label={form.showLogo ? 'Show logo' : 'Hide logo'}
                    />
                  </div>
                </Field>
              </div>
            </Section>

            <Section title="Header & Greeting">
              <Field label="Header Text">
                <input
                  type="text"
                  value={form.headerText}
                  onChange={(e) => handleChange('headerText', e.target.value)}
                  disabled={!canEdit}
                  placeholder="e.g. Anjani Medical — Your Trusted Health Partner"
                  className={inputCls(canEdit)}
                />
              </Field>
              <Field label="Customer Greeting" className="mt-4">
                <input
                  type="text"
                  value={form.customerGreeting}
                  onChange={(e) => handleChange('customerGreeting', e.target.value)}
                  disabled={!canEdit}
                  placeholder="e.g. Dear Valued Customer,"
                  className={inputCls(canEdit)}
                />
              </Field>
            </Section>

            <Section title="Body Content">
              <Field label="Body Text">
                <textarea
                  value={form.bodyText}
                  onChange={(e) => handleChange('bodyText', e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                  placeholder="Introduction paragraph shown at top of the quotation body…"
                  className={textareaCls(canEdit)}
                />
              </Field>
              <Field label="Terms & Conditions" className="mt-4">
                <textarea
                  value={form.termsAndConditions}
                  onChange={(e) => handleChange('termsAndConditions', e.target.value)}
                  disabled={!canEdit}
                  rows={5}
                  placeholder="List your terms, one per line…"
                  className={textareaCls(canEdit)}
                />
              </Field>
            </Section>

            <Section title="Commercial Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Validity (days)">
                  <input
                    type="number"
                    min={1}
                    value={form.validityDays}
                    onChange={(e) => handleChange('validityDays', parseInt(e.target.value) || 1)}
                    disabled={!canEdit}
                    className={inputCls(canEdit)}
                  />
                </Field>
                <Field label="Default Discount Text">
                  <input
                    type="text"
                    value={form.defaultDiscountText}
                    onChange={(e) => handleChange('defaultDiscountText', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. 5% discount on orders above ₹5,000"
                    className={inputCls(canEdit)}
                  />
                </Field>
                <Field label="Payment Note">
                  <input
                    type="text"
                    value={form.paymentNote}
                    onChange={(e) => handleChange('paymentNote', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. Cash, UPI, NEFT/RTGS"
                    className={inputCls(canEdit)}
                  />
                </Field>
                <Field label="Delivery Note">
                  <input
                    type="text"
                    value={form.deliveryNote}
                    onChange={(e) => handleChange('deliveryNote', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. Delivery within 1-2 working days"
                    className={inputCls(canEdit)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Contact Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Contact Phone">
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. +91 98291 00000"
                    className={inputCls(canEdit)}
                  />
                </Field>
                <Field label="Contact Email">
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. info@anjanimedical.in"
                    className={inputCls(canEdit)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Footer">
              <Field label="Footer Text">
                <textarea
                  value={form.footerText}
                  onChange={(e) => handleChange('footerText', e.target.value)}
                  disabled={!canEdit}
                  rows={2}
                  placeholder="Closing message shown at the bottom of the quote…"
                  className={textareaCls(canEdit)}
                />
              </Field>
            </Section>

            {/* Save / Cancel */}
            {canEdit && (
              <div className="px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/60 rounded-b-xl">
                {dirty && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg border border-[#D1DCF0] hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!dirty}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-[#0A3D91] hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Save Template
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete Template?</h3>
                <p className="text-sm text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete <span className="font-semibold">"{form.templateName}"</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg border border-[#D1DCF0] hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="px-6 py-5">
      <p className="text-xs font-semibold text-[#0A3D91] uppercase tracking-wide mb-4">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children, className = '', required }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, disabled, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
          value ? 'bg-[#0A3D91]' : 'bg-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  )
}

function inputCls(canEdit) {
  return [
    'w-full px-3 py-2 text-sm rounded-lg border transition-colors',
    canEdit
      ? 'border-[#D1DCF0] bg-white text-slate-800 focus:border-[#0A3D91] focus:ring-2 focus:ring-blue-100 outline-none'
      : 'border-[#D1DCF0] bg-slate-50 text-slate-500 cursor-not-allowed',
  ].join(' ')
}

function textareaCls(canEdit) {
  return [
    'w-full px-3 py-2 text-sm rounded-lg border transition-colors resize-y',
    canEdit
      ? 'border-[#D1DCF0] bg-white text-slate-800 focus:border-[#0A3D91] focus:ring-2 focus:ring-blue-100 outline-none'
      : 'border-[#D1DCF0] bg-slate-50 text-slate-500 cursor-not-allowed',
  ].join(' ')
}

function QuotePreview({ template: t }) {
  const today = new Date()
  const validity = new Date(today)
  validity.setDate(today.getDate() + (t.validityDays ?? 7))

  const fmt = (d) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="border border-[#D1DCF0] rounded-xl overflow-hidden text-sm text-slate-700 font-sans">
      {/* Header */}
      <div className="bg-[#0A3D91] text-white px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            {t.showLogo && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AM</span>
                </div>
                <span className="font-bold text-base">Anjani Medical</span>
              </div>
            )}
            {t.headerText && <p className="text-blue-200 text-xs">{t.headerText}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold">{t.quoteTitle || 'Quotation'}</p>
            <p className="text-blue-200 text-xs mt-1">Date: {fmt(today)}</p>
            <p className="text-blue-200 text-xs">Valid until: {fmt(validity)}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4 bg-white">
        {t.customerGreeting && (
          <p className="font-medium text-slate-700">{t.customerGreeting}</p>
        )}
        {t.bodyText && (
          <p className="text-slate-600 leading-relaxed">{t.bodyText}</p>
        )}

        {/* Sample items table */}
        <div className="border border-[#D1DCF0] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-50 text-[#0A3D91] font-semibold">
                <td className="px-3 py-2">#</td>
                <td className="px-3 py-2">Item / Description</td>
                <td className="px-3 py-2 text-right">Qty</td>
                <td className="px-3 py-2 text-right">Rate</td>
                <td className="px-3 py-2 text-right">Amount</td>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#D1DCF0] text-slate-500 italic">
                <td className="px-3 py-2 text-slate-400">1</td>
                <td className="px-3 py-2">[ Item details will appear here ]</td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 text-right">—</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-[#D1DCF0] bg-slate-50">
                <td colSpan={4} className="px-3 py-2 text-right font-semibold text-slate-700">Total</td>
                <td className="px-3 py-2 text-right font-bold text-[#0A3D91]">₹ 0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {t.defaultDiscountText && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Discount: {t.defaultDiscountText}
          </p>
        )}

        {/* Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {t.paymentNote && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-[#D1DCF0]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Payment</p>
              <p className="text-xs">{t.paymentNote}</p>
            </div>
          )}
          {t.deliveryNote && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-[#D1DCF0]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Delivery</p>
              <p className="text-xs">{t.deliveryNote}</p>
            </div>
          )}
        </div>

        {t.termsAndConditions && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Terms & Conditions</p>
            <div className="text-xs text-slate-500 leading-relaxed whitespace-pre-line border-t border-[#D1DCF0] pt-2">
              {t.termsAndConditions}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-blue-50 border-t border-[#D1DCF0] px-6 py-4">
        {t.footerText && <p className="text-slate-600 text-xs mb-2">{t.footerText}</p>}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {t.contactPhone && (
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {t.contactPhone}
            </span>
          )}
          {t.contactEmail && (
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t.contactEmail}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
