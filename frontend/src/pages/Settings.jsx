import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import AccessDenied from './AccessDenied'
import { useToast } from '../components/ui/Toast'
import {
  getSettings, saveSettings, DEFAULT_SETTINGS,
  exportAllData, importData, clearAllData, resetToSampleData,
} from '../services/storage'

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',    label: 'General' },
  { id: 'categories', label: 'Categories & Departments' },
  { id: 'backup',     label: 'Backup & Data' },
  { id: 'notifications', label: 'Notifications' }, // New tab
  { id: 'about',      label: 'About' },
]

// ── Shared UI primitives ───────────────────────────────────────────────────────

function Section({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl overflow-hidden mb-5 border border-[#D1DCF0] shadow-sm ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-[#D1DCF0]">
          <p className="text-slate-500 text-xs uppercase tracking-widest font-medium">{title}</p>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-5 last:mb-0">
      <label className="block text-sm font-medium text-[#111827] mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
      {children}
    </div>
  )
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full bg-white border border-[#D1DCF0] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10 transition-colors ${className}`}
      {...props}
    />
  )
}

function Select({ className = '', children, ...props }) { // New Select component
  return (
    <select
      className={`w-full bg-white border border-[#D1DCF0] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10 transition-colors appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

function Toggle({ label, checked, onChange, disabled = false }) { // New Toggle component
  return (
    <label className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <div className={`block w-10 h-6 rounded-full ${checked ? 'bg-[#0A3D91]' : 'bg-slate-300'}`} />
        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${checked ? 'translate-x-full' : ''}`} />
      </div>
      <div className="ml-3 text-sm font-medium text-[#111827]">{label}</div>
    </label>
  )
}


function Btn({ variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[#0A3D91] text-white border border-transparent hover:bg-[#0057D9]',
    danger:  'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
    ghost:   'bg-white text-slate-600 border border-[#D1DCF0] hover:bg-slate-50',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

function TagList({ items, onRemove, onAdd, placeholder }) {
  const [val, setVal] = useState('')

  function handleAdd() {
    const trimmed = val.trim()
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed)
      setVal('')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[#0A3D91] text-xs"
          >
            {item}
            <button
              onClick={() => onRemove(item)}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remove ${item}`}
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-slate-400 text-xs italic">No items yet</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="flex-1"
        />
        <Btn variant="ghost" onClick={handleAdd} type="button">Add</Btn>
      </div>
    </div>
  )
}

function ConfirmInput({ action, label, onConfirmed, loading }) {
  const [val, setVal] = useState('')
  const ready = val === 'CONFIRM'

  return (
    <div className="mt-3 flex flex-col sm:flex-row gap-2">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder='Type CONFIRM to enable'
        className="flex-1 text-xs"
      />
      <Btn
        variant="danger"
        disabled={!ready || loading}
        onClick={() => { onConfirmed(); setVal('') }}
      >
        {loading ? 'Working…' : label}
      </Btn>
    </div>
  )
}

// ── Tab: General ───────────────────────────────────────────────────────────────

function GeneralTab({ settings, onChange, onSave, saving }) {
  return (
    <Section title="Company">
      <Field label="Company Name">
        <Input
          value={settings.companyName}
          onChange={(e) => onChange('companyName', e.target.value)}
          placeholder="Anjani Medical"
        />
      </Field>
      <Field label="Branch Name">
        <Input
          value={settings.branchName}
          onChange={(e) => onChange('branchName', e.target.value)}
          placeholder="Main Branch"
        />
      </Field>

      <div className="mt-1 mb-5">
        <label className="block text-sm font-medium text-[#111827] mb-2">Working Hours</label>
        <div className="flex items-center gap-3">
          <Input
            type="time"
            value={settings.workingHoursStart}
            onChange={(e) => onChange('workingHoursStart', e.target.value)}
            className="w-36"
          />
          <span className="text-slate-500 text-sm">to</span>
          <Input
            type="time"
            value={settings.workingHoursEnd}
            onChange={(e) => onChange('workingHoursEnd', e.target.value)}
            className="w-36"
          />
        </div>
      </div>

      <Btn onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Settings'}
      </Btn>
    </Section>
  )
}

// ── Tab: Categories & Departments ─────────────────────────────────────────────

function CategoriesTab({ settings, onChange, onSave, saving }) {
  return (
    <>
      <Section title="Task Categories">
        <TagList
          items={settings.defaultCategories}
          onRemove={(item) => onChange('defaultCategories', settings.defaultCategories.filter((c) => c !== item))}
          onAdd={(item) => onChange('defaultCategories', [...settings.defaultCategories, item])}
          placeholder="Add category…"
        />
      </Section>
      <Section title="Departments">
        <TagList
          items={settings.defaultDepartments}
          onRemove={(item) => onChange('defaultDepartments', settings.defaultDepartments.filter((d) => d !== item))}
          onAdd={(item) => onChange('defaultDepartments', [...settings.defaultDepartments, item])}
          placeholder="Add department…"
        />
      </Section>
      <Btn onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </Btn>
    </>
  )
}

// ── Tab: Backup & Data ────────────────────────────────────────────────────────

function BackupTab() {
  const { showToast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [lastExport, setLastExport] = useState(() => localStorage.getItem('anjani_last_export'))
  const fileRef = useRef(null)

  useEffect(() => {
    const check = () => setLastExport(localStorage.getItem('anjani_last_export'))
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      await exportAllData()
      setLastExport(localStorage.getItem('anjani_last_export'))
      showToast('Backup downloaded successfully', 'success')
    } catch (e) {
      showToast(`Export failed: ${e.message}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    if (!window.confirm('This will overwrite current tasks, staff, and settings. Continue?')) {
      e.target.value = ''
      return
    }
    setImporting(true)
    try {
      const result = await importData(text)
      if (result.success) {
        showToast(result.message, 'success')
      } else {
        showToast(result.message, 'error')
      }
    } catch (err) {
      showToast(`Import error: ${err.message}`, 'error')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      await clearAllData()
      showToast('All tasks and staff cleared', 'success')
    } catch (e) {
      showToast(`Clear failed: ${e.message}`, 'error')
    } finally {
      setClearing(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      await resetToSampleData()
      showToast('Sample data restored — 6 staff, 3 tasks', 'success')
    } catch (e) {
      showToast(`Reset failed: ${e.message}`, 'error')
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <Section title="Export Data">
        <p className="text-slate-400 text-sm mb-4">
          Download a full JSON backup of all tasks, staff, and settings.
        </p>
        {lastExport && (
          <p className="text-slate-400 text-xs mb-3">
            Last export: {new Date(lastExport).toLocaleString()}
          </p>
        )}
        <Btn onClick={handleExport} disabled={exporting}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting…' : 'Export All Data as JSON'}
        </Btn>
      </Section>

      <Section title="Import Data">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-4">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-amber-300 text-xs leading-relaxed">
            This will overwrite all current tasks, staff, and settings with data from the backup file.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
        />
        <Btn variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
          </svg>
          {importing ? 'Importing…' : 'Choose Backup File (.json)'}
        </Btn>
      </Section>

      <div className="bg-white rounded-2xl overflow-hidden border border-red-200">
        <div className="px-5 py-3.5 border-b border-red-200 bg-red-50">
          <p className="text-red-600 text-xs uppercase tracking-widest font-medium">Danger Zone</p>
        </div>
        <div className="p-5 space-y-6">
          <div>
            <p className="text-[#111827] text-sm font-medium">Clear All Data</p>
            <p className="text-slate-500 text-xs mt-0.5 mb-2">
              Permanently removes all tasks and staff. Settings are preserved.
            </p>
            <ConfirmInput
              label="Clear All Data"
              onConfirmed={handleClear}
              loading={clearing}
            />
          </div>
          <div className="border-t border-[#D1DCF0] pt-6">
            <p className="text-[#111827] text-sm font-medium">Reset to Sample Data</p>
            <p className="text-slate-500 text-xs mt-0.5 mb-2">
              Wipes everything and re-seeds 6 default staff members and 3 sample tasks.
            </p>
            <ConfirmInput
              label="Reset to Sample Data"
              onConfirmed={handleReset}
              loading={resetting}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ── Tab: About ─────────────────────────────────────────────────────────────────

const PHASES = [
  { label: 'Phase 1', detail: 'Scaffold & health check', done: true },
  { label: 'Phase 2', detail: 'Dashboard, tasks, staff, calendar, reports', done: true },
  { label: 'Phase 3', detail: 'Settings, backup & data tools', done: true },
]

const STACK = [
  ['Frontend', 'React 18 · Vite · Tailwind CSS'],
  ['Backend',  'Node.js · Express · better-sqlite3'],
  ['Auth',     'Role-based (Admin / Manager / Staff)'],
  ['Storage',  'SQLite (tasks & staff) · localStorage (settings)'],
]

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#D1DCF0] last:border-0 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-[#111827] font-mono text-xs bg-[#F0F4FF] border border-[#D1DCF0] rounded-md px-2 py-1">{value}</span>
    </div>
  )
}

function AboutTab() {
  return (
    <>
      {/* Launch Safety Banner */}
      <Section className="bg-red-50 border-red-200 text-red-700">
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">Current launch mode: Local browser storage.</p>
            <p className="text-xs mt-1">Use for pilot/testing only. For real multi-staff use, connect Supabase/SQLite database.</p>
          </div>
        </div>
      </Section>

      <Section title="Application">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#0A3D91]" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-[#111827] font-semibold">Anjani Staff Task Command Center</p>
            <p className="text-slate-500 text-xs mt-0.5">v1.0.0 · Developed for Anjani Medical</p>
          </div>
        </div>
        <InfoRow label="Version"     value="v1.0.0" />
        <InfoRow label="Build"       value="2025" />
        <InfoRow label="Environment" value="development" />
      </Section>

      <Section title="Phase Completion">
        <div className="space-y-3">
          {PHASES.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${p.done ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                {p.done && (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <span className="text-[#111827] text-sm font-medium">{p.label}</span>
                <span className="text-slate-500 text-xs ml-2">{p.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tech Stack">
        {STACK.map(([label, value]) => (
          <InfoRow key={label} label={label} value={value} />
        ))}
      </Section>
    </>
  )
}

// ── Tab: Notifications ─────────────────────────────────────────────────────────

import {
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  getBrowserNotificationFallbackMessage,
} from '../services/notificationService'

function NotificationsTab({ settings, onChange, onSave, saving }) {
  const { showToast } = useToast()
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState(getBrowserNotificationPermission())

  useEffect(() => {
    // Note: 'permissionchange' event is not standard across all browsers,
    // so a re-check on focus or component mount is more reliable.
    // For now, we rely on the component mounting and re-checking.
    // A more robust solution might involve polling or a custom event.
    setBrowserPermissionStatus(Notification.permission)
  }, [])

  async function handleRequestBrowserPermission() {
    const permission = await requestBrowserNotificationPermission()
    setBrowserPermissionStatus(permission)
    if (permission === 'granted') {
      showToast('Browser notifications enabled!', 'success')
      onChange('browserNotificationsEnabled', true) // Also update app setting
    } else if (permission === 'denied') {
      showToast('Browser notifications blocked. Please enable in browser settings.', 'error')
      onChange('browserNotificationsEnabled', false) // Also update app setting
    } else { // default or unsupported
      showToast('Browser notifications not enabled.', 'info')
      onChange('browserNotificationsEnabled', false) // Also update app setting
    }
  }

  const browserNotificationFallback = getBrowserNotificationFallbackMessage()

  return (
    <>
      <Section title="Browser Notifications">
        <Field
          label="Enable Browser Push Notifications"
          hint="Receive alerts even when the app is in the background."
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Current Status: <strong>{browserPermissionStatus}</strong></span>
            {browserPermissionStatus !== 'granted' && browserPermissionStatus !== 'unsupported' && (
              <Btn
                onClick={handleRequestBrowserPermission}
                variant="ghost"
                type="button"
                className="ml-auto"
                disabled={browserPermissionStatus === 'denied'}
              >
                {browserPermissionStatus === 'default' ? 'Enable Notifications' : 'Re-enable Notifications'}
              </Btn>
            )}
          </div>
          {browserPermissionStatus === 'denied' && (
            <p className="text-xs text-red-500 mt-2">{browserNotificationFallback}</p>
          )}
          {browserPermissionStatus === 'unsupported' && (
            <p className="text-xs text-slate-500 mt-2">{browserNotificationFallback}</p>
          )}
        </Field>
        {browserPermissionStatus === 'granted' && (
          <Toggle
            label="In-App Setting: Receive Browser Notifications"
            checked={settings.browserNotificationsEnabled}
            onChange={(e) => onChange('browserNotificationsEnabled', e.target.checked)}
            // hint="This controls whether the app will attempt to show browser notifications, independent of browser permission."
          />
        )}
      </Section>

      <Section title="In-App Notification Preferences">
        <Field label="Task Reminders" hint="Get notified for upcoming tasks.">
          <Toggle
            label="Enable Task Reminders"
            checked={settings.taskRemindersEnabled}
            onChange={(e) => onChange('taskRemindersEnabled', e.target.checked)}
          />
        </Field>
        <Field label="Overdue Alerts" hint="Receive alerts for delayed tasks.">
          <Toggle
            label="Enable Overdue Alerts"
            checked={settings.overdueAlertsEnabled}
            onChange={(e) => onChange('overdueAlertsEnabled', e.target.checked)}
          />
        </Field>
        <Field label="Checklist Alerts" hint="Get reminders for incomplete checklists.">
          <Toggle
            label="Enable Checklist Alerts"
            checked={settings.checklistAlertsEnabled}
            onChange={(e) => onChange('checklistAlertsEnabled', e.target.checked)}
          />
        </Field>
        <Field label="Reminder Time Preference">
          <Select
            value={settings.reminderTimePreference}
            onChange={(e) => onChange('reminderTimePreference', e.target.value)}
          >
            <option value="morning">Morning (9 AM)</option>
            <option value="afternoon">Afternoon (1 PM)</option>
            <option value="evening">Evening (5 PM)</option>
          </Select>
        </Field>
      </Section>
      <Btn onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Notification Settings'}
      </Btn>
    </>
  )
}

// ── Main Settings page ─────────────────────────────────────────────────────────

export default function Settings() {
  const { hasPermission } = useAuth()
  if (!hasPermission('access_settings')) return <AccessDenied />

  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState(() => getSettings())
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  function handleChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      saveSettings(settings)
      showToast('Settings saved', 'success')
    } catch (e) {
      showToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#111827] tracking-tight mb-1">Settings</h2>
        <p className="text-slate-500 text-sm">Configure the app, manage data, and view system info.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white border border-[#D1DCF0] rounded-xl p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#F0F4FF] text-[#0A3D91] border-b-2 border-[#0A3D91] font-semibold'
                : 'text-slate-500 hover:text-[#0A3D91]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <GeneralTab settings={settings} onChange={handleChange} onSave={handleSave} saving={saving} />
      )}
      {activeTab === 'categories' && (
        <CategoriesTab settings={settings} onChange={handleChange} onSave={handleSave} saving={saving} />
      )}
      {activeTab === 'backup' && <BackupTab />}
      {activeTab === 'notifications' && (
        <NotificationsTab settings={settings} onChange={handleChange} onSave={handleSave} saving={saving} />
      )}
      {activeTab === 'about' && <AboutTab />}
    </div>
  )
}