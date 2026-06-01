import { useMemo, useState } from 'react'
import {
  calculateCommission,
  calculateRemainingSales,
  calculateSalesProgress,
  getStaffSalesTargets,
  resetStaffSalesTargets,
  saveStaffSalesTargets,
} from '../data/salesTargets'

const inputCls = 'w-full rounded-lg border border-[#D1DCF0] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition-colors focus:border-[#0A3D91] focus:ring-2 focus:ring-[#0A3D91]/10'

function formatMoney(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function Field({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
      <div className="relative">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(toNumber(e.target.value))}
          className={`${inputCls} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

function PreviewPill({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-[#0A3D91] border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  )
}

function StaffTargetCard({ target, onUpdate }) {
  const progressPercent = calculateSalesProgress(target.todaySalesAchieved, target.dailySalesTarget)
  const remainingSales = calculateRemainingSales(target.dailySalesTarget, target.todaySalesAchieved)
  const commission = calculateCommission(
    progressPercent,
    target.commissionRule,
    100,
    target.minimumRoutineCompletionPercent
  )

  function updateField(field, value) {
    onUpdate({ ...target, [field]: value })
  }

  function updateTier(index, reward) {
    const nextRule = target.commissionRule.map((tier, tierIndex) => (
      tierIndex === index ? { ...tier, reward } : tier
    ))
    updateField('commissionRule', nextRule)
  }

  return (
    <section className="rounded-2xl border border-[#D1DCF0] bg-white/95 p-4 shadow-[0_14px_34px_rgba(10,61,145,0.07)] sm:p-5">
      <div className="flex flex-col gap-3 border-b border-[#D1DCF0] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[#111827]">{target.staffName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{target.role}</p>
        </div>
        <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
          Active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Field
          label="Daily Target"
          value={target.dailySalesTarget}
          onChange={(value) => updateField('dailySalesTarget', value)}
        />
        <Field
          label="Monthly Target"
          value={target.monthlySalesTarget}
          onChange={(value) => updateField('monthlySalesTarget', value)}
        />
        <Field
          label="Today Achieved"
          value={target.todaySalesAchieved}
          onChange={(value) => updateField('todaySalesAchieved', value)}
        />
        <Field
          label="Monthly Achieved"
          value={target.monthlySalesAchieved}
          onChange={(value) => updateField('monthlySalesAchieved', value)}
        />
        <Field
          label="Routine Minimum"
          value={target.minimumRoutineCompletionPercent}
          onChange={(value) => updateField('minimumRoutineCompletionPercent', value)}
          suffix="%"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0A3D91]">Commission Tiers</p>
          <p className="text-[11px] text-slate-500">Rewards unlock by daily target progress</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {target.commissionRule.map((tier, index) => (
            <label key={`${target.staffId}-${tier.minPercent}`} className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                {tier.minPercent}% reward
              </span>
              <input
                type="number"
                min="0"
                value={tier.reward}
                onChange={(e) => updateTier(index, toNumber(e.target.value))}
                className={inputCls}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PreviewPill label="Progress" value={`${progressPercent}%`} />
        <PreviewPill label="Estimated Today Commission" value={formatMoney(commission.reward)} tone="emerald" />
        <PreviewPill label="Remaining Sales Needed" value={formatMoney(remainingSales)} tone="amber" />
      </div>
    </section>
  )
}

export default function Incentives() {
  const [targets, setTargets] = useState(() => getStaffSalesTargets())
  const [savedMessage, setSavedMessage] = useState('')

  const summary = useMemo(() => {
    const activeTargets = targets.filter((target) => target.isActive)
    const totalTarget = activeTargets.reduce((sum, target) => sum + target.dailySalesTarget, 0)
    const totalAchieved = activeTargets.reduce((sum, target) => sum + target.todaySalesAchieved, 0)
    const commissionLiability = activeTargets.reduce((sum, target) => {
      const progressPercent = calculateSalesProgress(target.todaySalesAchieved, target.dailySalesTarget)
      const commission = calculateCommission(
        progressPercent,
        target.commissionRule,
        100,
        target.minimumRoutineCompletionPercent
      )
      return sum + commission.reward
    }, 0)

    return {
      totalTarget,
      totalAchieved,
      totalProgressPercent: calculateSalesProgress(totalAchieved, totalTarget),
      commissionLiability,
    }
  }, [targets])

  function updateTarget(updatedTarget) {
    setTargets((prev) => prev.map((target) => (
      target.staffId === updatedTarget.staffId ? updatedTarget : target
    )))
    setSavedMessage('')
  }

  function handleSave() {
    setTargets(saveStaffSalesTargets(targets))
    setSavedMessage('Sales targets saved for this browser.')
  }

  function handleReset() {
    if (!window.confirm('Reset sales targets and commission rewards to default values?')) return
    setTargets(resetStaffSalesTargets())
    setSavedMessage('Sales targets reset to default values.')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 sm:p-6">
      <div className="rounded-2xl border border-[#D1DCF0] bg-gradient-to-br from-white via-blue-50/70 to-teal-50/50 p-4 shadow-[0_18px_42px_rgba(10,61,145,0.09)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 w-fit rounded-full border border-blue-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0A3D91]">
              MVP Manual Entry
            </p>
            <h2 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">Sales Targets & Incentives</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
              Sales achieved is manually entered for now. Later this can connect to POS/RPOS or billing data.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleReset}
              className="rounded-lg border border-[#D1DCF0] bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-[#0A3D91] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0057D9]"
            >
              Save Targets
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PreviewPill label="Total Daily Target" value={formatMoney(summary.totalTarget)} />
          <PreviewPill label="Total Achieved" value={formatMoney(summary.totalAchieved)} tone="emerald" />
          <PreviewPill label="Team Progress" value={`${summary.totalProgressPercent}%`} />
          <PreviewPill label="Commission Liability" value={formatMoney(summary.commissionLiability)} tone="amber" />
        </div>

        {savedMessage && (
          <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {savedMessage}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {targets.map((target) => (
          <StaffTargetCard key={target.staffId} target={target} onUpdate={updateTarget} />
        ))}
      </div>
    </div>
  )
}
