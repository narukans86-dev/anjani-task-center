const SALES_TARGETS_KEY = 'anjaniSalesTargets-v1'

export const DEFAULT_COMMISSION_RULE = [
  { minPercent: 80, reward: 100, label: 'Starter' },
  { minPercent: 100, reward: 250, label: 'Target Hit' },
  { minPercent: 120, reward: 500, label: 'Champion' },
]

export const DEFAULT_STAFF_SALES_TARGETS = [
  {
    staffId: 1,
    staffName: 'Virendra Singh',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 2,
    staffName: 'Naveen',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 4,
    staffName: 'Rakesh Kumar Meena',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 5,
    staffName: 'Aditya Parashar',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 6,
    staffName: 'Vakil Gurjar',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 3,
    staffName: 'Raj Laxkar',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
]

function cloneDefaults() {
  return DEFAULT_STAFF_SALES_TARGETS.map((target) => ({
    ...target,
    commissionRule: target.commissionRule.map((tier) => ({ ...tier })),
  }))
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeCommissionRule(rule) {
  const source = Array.isArray(rule) && rule.length ? rule : DEFAULT_COMMISSION_RULE
  return source
    .map((tier) => ({
      minPercent: safeNumber(tier.minPercent),
      reward: Math.max(0, safeNumber(tier.reward)),
      label: String(tier.label || '').trim() || `${safeNumber(tier.minPercent)}%`,
    }))
    .filter((tier) => tier.minPercent > 0)
    .sort((a, b) => a.minPercent - b.minPercent)
}

function normalizeTarget(target, fallback = {}) {
  return {
    staffId: safeNumber(target.staffId ?? fallback.staffId),
    staffName: String(target.staffName || fallback.staffName || '').trim(),
    dailySalesTarget: Math.max(0, safeNumber(target.dailySalesTarget ?? fallback.dailySalesTarget)),
    monthlySalesTarget: Math.max(0, safeNumber(target.monthlySalesTarget ?? fallback.monthlySalesTarget)),
    todaySalesAchieved: Math.max(0, safeNumber(target.todaySalesAchieved ?? fallback.todaySalesAchieved)),
    monthlySalesAchieved: Math.max(0, safeNumber(target.monthlySalesAchieved ?? fallback.monthlySalesAchieved)),
    commissionRule: normalizeCommissionRule(target.commissionRule ?? fallback.commissionRule),
    minimumRoutineCompletionPercent: Math.max(
      0,
      safeNumber(target.minimumRoutineCompletionPercent ?? fallback.minimumRoutineCompletionPercent ?? 70)
    ),
    isActive: target.isActive ?? fallback.isActive ?? true,
  }
}

function mergeWithDefaults(savedTargets) {
  const savedByStaffId = new Map(
    (Array.isArray(savedTargets) ? savedTargets : [])
      .map((target) => [String(target.staffId), target])
  )

  return cloneDefaults().map((defaultTarget) => {
    const savedTarget = savedByStaffId.get(String(defaultTarget.staffId))
    return normalizeTarget(savedTarget || defaultTarget, defaultTarget)
  })
}

// MVP localStorage storage. Later this can be replaced by POS/backend sales data.
export function getStaffSalesTargets() {
  try {
    const raw = localStorage.getItem(SALES_TARGETS_KEY)
    if (!raw) return cloneDefaults()
    return mergeWithDefaults(JSON.parse(raw))
  } catch {
    return cloneDefaults()
  }
}

export function saveStaffSalesTargets(targets) {
  const normalized = mergeWithDefaults(targets)
  localStorage.setItem(SALES_TARGETS_KEY, JSON.stringify(normalized))
  return normalized
}

export function calculateSalesProgress(achieved, target) {
  const safeTarget = safeNumber(target)
  if (safeTarget <= 0) return 0
  return Math.max(0, Math.round((safeNumber(achieved) / safeTarget) * 100))
}

export function calculateRemainingSales(target, achieved) {
  return Math.max(0, safeNumber(target) - safeNumber(achieved))
}

export function calculateCommission(
  progressPercent,
  rule,
  routineCompletionPercent = 100,
  minimumRoutineCompletionPercent = 70
) {
  const normalizedRule = normalizeCommissionRule(rule)
  const routinePercent = safeNumber(routineCompletionPercent)
  const minimumRoutine = safeNumber(minimumRoutineCompletionPercent, 70)

  if (routinePercent < minimumRoutine) return { reward: 0, label: 'Routine Below Minimum', matchedTier: null }
  if (safeNumber(progressPercent) < 80) return { reward: 0, label: 'Below 80%', matchedTier: null }

  const eligibleTiers = normalizedRule.filter((tier) => safeNumber(progressPercent) >= tier.minPercent)
  const matchedTier = eligibleTiers[eligibleTiers.length - 1]

  return matchedTier
    ? { reward: matchedTier.reward, label: matchedTier.label, matchedTier }
    : { reward: 0, label: 'No Tier', matchedTier: null }
}

export function getTodayIncentiveSummary(routineCompletionByStaffId = {}) {
  const staffTargets = getStaffSalesTargets()
  const staffSummaries = staffTargets
    .filter((target) => target.isActive)
    .map((target) => {
      const progressPercent = calculateSalesProgress(target.todaySalesAchieved, target.dailySalesTarget)
      const routineCompletionPercent = safeNumber(
        routineCompletionByStaffId[target.staffId],
        target.minimumRoutineCompletionPercent
      )
      const commission = routineCompletionPercent < target.minimumRoutineCompletionPercent
        ? { reward: 0, label: 'Routine Below Minimum', matchedTier: null }
        : calculateCommission(
            progressPercent,
            target.commissionRule,
            routineCompletionPercent,
            target.minimumRoutineCompletionPercent
          )

      return {
        ...target,
        progressPercent,
        routineCompletionPercent,
        remainingSales: calculateRemainingSales(target.dailySalesTarget, target.todaySalesAchieved),
        estimatedCommission: commission.reward,
        commissionLabel: commission.label,
      }
    })

  const totalTarget = staffSummaries.reduce((sum, target) => sum + target.dailySalesTarget, 0)
  const totalAchieved = staffSummaries.reduce((sum, target) => sum + target.todaySalesAchieved, 0)
  const commissionLiability = staffSummaries.reduce((sum, target) => sum + target.estimatedCommission, 0)

  return {
    staff: staffSummaries,
    totalTarget,
    totalAchieved,
    totalProgressPercent: calculateSalesProgress(totalAchieved, totalTarget),
    commissionLiability,
    staffOnTarget: staffSummaries.filter((target) => target.progressPercent >= 100).length,
    staffBelowMinimum: staffSummaries.filter((target) => target.progressPercent < 80).length,
  }
}

export { SALES_TARGETS_KEY }
