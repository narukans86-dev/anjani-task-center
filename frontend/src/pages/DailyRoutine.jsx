import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  DAILY_ROUTINE_STAFF,
  FREE_TIME_PRIORITIES,
  REPORT_FIELDS,
  dailyRoutineStorageKey,
  getShiftFocus,
  readDailyRoutineState,
  routineDateKey,
  routineProgressFor,
  routineStatus,
  writeDailyRoutineState,
} from '../data/dailyRoutine'

const STATUS_STYLE = {
  'On Track': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  'Needs Attention': 'bg-red-50 text-red-600 border-red-200',
}

function initials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function RoutineCard({ staff, checks, canEdit, onToggle }) {
  const progress = routineProgressFor(staff, checks)
  const status = routineStatus(progress.percent)

  return (
    <section className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-4 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)]">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-[#0A3D91] flex items-center justify-center text-xs font-bold shrink-0">
          {initials(staff.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[#111827] font-semibold truncate">{staff.name}</h3>
              <p className="text-[#0A3D91] text-xs font-semibold mt-0.5">{staff.role}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[status]}`}>
              {status}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">{staff.timing}</p>
          <p className="text-slate-600 text-xs leading-relaxed mt-2 rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2">
            {staff.responsibility}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-slate-500 text-xs font-semibold">
          {progress.completed}/{progress.total} completed
        </p>
        <p className="text-[#111827] text-sm font-bold tabular-nums">{progress.percent}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#0A3D91] transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {staff.checklist.map((item, index) => {
          const checked = Boolean(checks[staff.name]?.[index])
          return (
            <label
              key={item}
              className={[
                'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                checked ? 'bg-emerald-50/70 border-emerald-100' : 'bg-white border-[#E8EFFF]',
                canEdit ? 'cursor-pointer hover:bg-blue-50/60' : 'cursor-default',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!canEdit}
                onChange={() => onToggle(staff.name, index)}
                className="mt-0.5 h-4 w-4 accent-[#0A3D91]"
              />
              <span className={`text-sm leading-snug ${checked ? 'text-emerald-800' : 'text-[#111827]'}`}>
                {item}
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

export default function DailyRoutine() {
  const { user } = useAuth()
  const today = routineDateKey()
  const storageKey = dailyRoutineStorageKey()
  const [state, setState] = useState(() => readDailyRoutineState())

  const visibleStaff = useMemo(() => {
    if (user?.role === 'staff') {
      return DAILY_ROUTINE_STAFF.filter((staff) => staff.name === user.name)
    }
    return DAILY_ROUTINE_STAFF
  }, [user])

  const canEditStaff = (staffName) => {
    if (user?.role === 'admin' || user?.role === 'manager') return true
    if (user?.role === 'staff') return user.name === staffName
    return false
  }

  function updateState(next) {
    setState(next)
    writeDailyRoutineState(next)
  }

  function toggleCheck(staffName, index) {
    if (!canEditStaff(staffName)) return
    const current = state.checks[staffName] || []
    const nextStaffChecks = [...current]
    nextStaffChecks[index] = !nextStaffChecks[index]
    updateState({
      ...state,
      checks: {
        ...state.checks,
        [staffName]: nextStaffChecks,
      },
    })
  }

  function updateReport(staffName, field, value) {
    if (!canEditStaff(staffName)) return
    updateState({
      ...state,
      report: {
        ...state.report,
        [staffName]: {
          ...(state.report[staffName] || {}),
          [field]: value,
        },
      },
    })
  }

  const shiftFocus = getShiftFocus()

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      <section className="rounded-2xl border border-[#D1DCF0] bg-white/90 p-4 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)]">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[#0A3D91] text-xs font-bold tracking-[0.16em] uppercase mb-1">Daily Operations</p>
            <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Daily Routine Checklist</h2>
            <p className="text-slate-500 text-sm mt-1">
              Every staff member has role-specific daily work. Free time must become productive time.
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-slate-500 text-xs">Storage key</p>
            <p className="text-[#0A3D91] text-sm font-semibold">{storageKey}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#D1DCF0] bg-gradient-to-br from-[#0A3D91] to-[#0057D9] p-4 sm:p-5 text-white shadow-[0_18px_42px_rgba(10,61,145,0.16)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-white/75 text-xs font-semibold uppercase tracking-wide">Shift Focus Banner</p>
            <h3 className="text-xl font-bold mt-1">{shiftFocus}</h3>
            <p className="text-white/75 text-xs mt-1">{today}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {[
              '8:00 AM - 9:00 AM: Opening Preparation',
              '9:00 AM - 1:00 PM: Rush Time - Counter Sales Focus',
              '1:00 PM - 4:00 PM: Low Time - Backend Work Compulsory',
              '4:00 PM - 8:00 PM: Evening Rush - Counter Focus',
              '8:00 PM - 10:30 PM: Closing + Backend Work',
              'Other time: Off-hours / Preparation',
            ].map((item) => (
              <span key={item} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-white/90">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {visibleStaff.length === 0 ? (
        <section className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-8 text-center">
          <p className="text-slate-600 text-sm">No routine card is assigned to this staff login.</p>
        </section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {visibleStaff.map((staff) => (
            <RoutineCard
              key={staff.name}
              staff={staff}
              checks={state.checks}
              canEdit={canEditStaff(staff.name)}
              onToggle={toggleCheck}
            />
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-4 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)]">
        <div className="mb-4">
          <h3 className="text-[#111827] font-semibold">Free Time Priority Board</h3>
          <p className="text-slate-500 text-xs mt-0.5">General guidance only. This board is not tickable per staff.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {FREE_TIME_PRIORITIES.map((item) => (
            <div key={item} className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-3 text-sm font-medium text-[#111827]">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-4 sm:p-5 shadow-[0_14px_34px_rgba(10,61,145,0.07)]">
        <div className="mb-4">
          <h3 className="text-[#111827] font-semibold">Daily Closing Mini Report</h3>
          <p className="text-slate-500 text-xs mt-0.5">Use short notes for end-of-day confirmation.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#E8EFFF]">
                <th className="text-left text-slate-500 text-xs font-semibold uppercase tracking-wide py-2 pr-3">Staff</th>
                {REPORT_FIELDS.map((field) => (
                  <th key={field.key} className="text-left text-slate-500 text-xs font-semibold uppercase tracking-wide py-2 px-2">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4FF]">
              {visibleStaff.map((staff) => {
                const canEdit = canEditStaff(staff.name)
                return (
                  <tr key={staff.name}>
                    <td className="py-3 pr-3 align-top">
                      <p className="font-semibold text-[#111827]">{staff.name}</p>
                      <p className="text-slate-500 text-xs">{staff.role}</p>
                    </td>
                    {REPORT_FIELDS.map((field) => (
                      <td key={field.key} className="py-3 px-2 align-top">
                        <textarea
                          value={state.report[staff.name]?.[field.key] || ''}
                          disabled={!canEdit}
                          onChange={(e) => updateReport(staff.name, field.key, e.target.value)}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-[#D1DCF0] bg-white px-2 py-1.5 text-xs text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10 disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder={canEdit ? 'Add note' : 'Read only'}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
