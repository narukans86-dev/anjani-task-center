const SALES_TARGETS_KEY = 'anjaniSalesTargets-v1'

export const DEFAULT_COMMISSION_RULE = [
  { minPercent: 80, reward: 100, label: 'Starter' },
  { minPercent: 100, reward: 250, label: 'Target Hit' },
  { minPercent: 120, reward: 500, label: 'Champion' },
]

export const PRODUCT_PUSH_PRESETS = [
  'BP Machine',
  'Sugar Machine / Glucometer',
  'Glucometer Strips',
  'Thermometer',
  'Nebulizer',
  'Protein Powder',
  'Cosmetics',
  'Chronic Refill Pack',
  'Custom Item',
]

export const DEFAULT_ITEM_TARGET = {
  id: 'custom-item',
  itemName: 'Custom Item',
  targetQty: 0,
  achievedQty: 0,
  targetValue: 0,
  achievedValue: 0,
  rewardPerUnit: 0,
  bonusOnTarget: 0,
  isActive: true,
}

export const DEFAULT_STAFF_SALES_TARGETS = [
  {
    staffId: 1,
    staffName: 'Virendra Singh',
    role: 'Opening + Counter Control',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    itemTargets: [],
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 2,
    staffName: 'Naveen',
    role: 'Opening + Customer Support',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    itemTargets: [],
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 4,
    staffName: 'Rakesh Kumar Meena',
    role: 'Sales Manager',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    itemTargets: [],
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 5,
    staffName: 'Aditya Parashar',
    role: 'Evening Counter + Closing Support',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    itemTargets: [],
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 6,
    staffName: 'Vakil Gurjar',
    role: 'Purchase Manager',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    itemTargets: [],
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
  {
    staffId: 3,
    staffName: 'Raj Laxkar',
    role: 'Daily Accounts / Accountant',
    dailySalesTarget: 0,
    monthlySalesTarget: 0,
    todaySalesAchieved: 0,
    monthlySalesAchieved: 0,
    commissionRule: DEFAULT_COMMISSION_RULE,
    itemTargets: [],
    minimumRoutineCompletionPercent: 70,
    isActive: true,
  },
]

function cloneDefaults() {
  return DEFAULT_STAFF_SALES_TARGETS.map((target) => ({
    ...target,
    commissionRule: target.commissionRule.map((tier) => ({ ...tier })),
    itemTargets: target.itemTargets.map((item) => ({ ...item })),
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

function slugify(value) {
  return String(value || 'custom-item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-item'
}

function normalizeItemTarget(itemTarget = {}) {
  const itemName = String(itemTarget.itemName || DEFAULT_ITEM_TARGET.itemName).trim() || DEFAULT_ITEM_TARGET.itemName
  return {
    id: String(itemTarget.id || slugify(itemName)).trim(),
    itemName,
    targetQty: Math.max(0, safeNumber(itemTarget.targetQty)),
    achievedQty: Math.max(0, safeNumber(itemTarget.achievedQty)),
    targetValue: Math.max(0, safeNumber(itemTarget.targetValue)),
    achievedValue: Math.max(0, safeNumber(itemTarget.achievedValue)),
    rewardPerUnit: Math.max(0, safeNumber(itemTarget.rewardPerUnit)),
    bonusOnTarget: Math.max(0, safeNumber(itemTarget.bonusOnTarget)),
    isActive: itemTarget.isActive ?? true,
  }
}

function normalizeTarget(target, fallback = {}) {
  return {
    staffId: safeNumber(target.staffId ?? fallback.staffId),
    staffName: String(target.staffName || fallback.staffName || '').trim(),
    role: String(target.role || fallback.role || '').trim(),
    dailySalesTarget: Math.max(0, safeNumber(target.dailySalesTarget ?? fallback.dailySalesTarget)),
    monthlySalesTarget: Math.max(0, safeNumber(target.monthlySalesTarget ?? fallback.monthlySalesTarget)),
    todaySalesAchieved: Math.max(0, safeNumber(target.todaySalesAchieved ?? fallback.todaySalesAchieved)),
    monthlySalesAchieved: Math.max(0, safeNumber(target.monthlySalesAchieved ?? fallback.monthlySalesAchieved)),
    commissionRule: normalizeCommissionRule(target.commissionRule ?? fallback.commissionRule),
    itemTargets: Array.isArray(target.itemTargets)
      ? target.itemTargets.map(normalizeItemTarget)
      : [],
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

export function resetStaffSalesTargets() {
  const defaults = cloneDefaults()
  localStorage.setItem(SALES_TARGETS_KEY, JSON.stringify(defaults))
  return defaults
}

export function calculateSalesProgress(achieved, target) {
  const safeTarget = safeNumber(target)
  if (safeTarget <= 0) return 0
  return Math.max(0, Math.round((safeNumber(achieved) / safeTarget) * 100))
}

export function calculateRemainingSales(target, achieved) {
  return Math.max(0, safeNumber(target) - safeNumber(achieved))
}

export function calculateItemProgress(itemTarget = {}) {
  const item = normalizeItemTarget(itemTarget)
  const qtyProgress = item.targetQty > 0
    ? Math.round((item.achievedQty / item.targetQty) * 100)
    : null
  const valueProgress = item.targetValue > 0
    ? Math.round((item.achievedValue / item.targetValue) * 100)
    : null
  const activeProgress = [qtyProgress, valueProgress].filter((value) => value !== null)
  const progressPercent = activeProgress.length
    ? Math.max(0, Math.round(activeProgress.reduce((sum, value) => sum + value, 0) / activeProgress.length))
    : 0

  let status = 'Not Started'
  if (progressPercent >= 120) status = 'Champion'
  else if (progressPercent >= 100) status = 'Target Hit'
  else if (progressPercent > 0) status = 'In Progress'

  return {
    qtyProgress,
    valueProgress,
    progressPercent,
    remainingQty: Math.max(0, item.targetQty - item.achievedQty),
    remainingValue: Math.max(0, item.targetValue - item.achievedValue),
    hasQtyTarget: item.targetQty > 0,
    hasValueTarget: item.targetValue > 0,
    status,
  }
}

export function calculateItemCommission(itemTarget = {}) {
  const item = normalizeItemTarget(itemTarget)
  const progress = calculateItemProgress(item)
  const unitReward = item.rewardPerUnit * item.achievedQty
  const targetHit = (
    (progress.hasQtyTarget && item.achievedQty >= item.targetQty) ||
    (progress.hasValueTarget && item.achievedValue >= item.targetValue)
  )

  return {
    reward: unitReward + (targetHit ? item.bonusOnTarget : 0),
    unitReward,
    bonusReward: targetHit ? item.bonusOnTarget : 0,
    targetHit,
  }
}

export function calculateStaffItemCommission(staffTarget = {}) {
  return (staffTarget.itemTargets || [])
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + calculateItemCommission(item).reward, 0)
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
        estimatedItemCommission: calculateStaffItemCommission(target),
        commissionLabel: commission.label,
      }
    })

  const totalTarget = staffSummaries.reduce((sum, target) => sum + target.dailySalesTarget, 0)
  const totalAchieved = staffSummaries.reduce((sum, target) => sum + target.todaySalesAchieved, 0)
  const commissionLiability = staffSummaries.reduce((sum, target) => sum + target.estimatedCommission, 0)
  const itemCommissionLiability = staffSummaries.reduce((sum, target) => sum + target.estimatedItemCommission, 0)

  return {
    staff: staffSummaries,
    totalTarget,
    totalAchieved,
    totalProgressPercent: calculateSalesProgress(totalAchieved, totalTarget),
    commissionLiability,
    itemCommissionLiability,
    combinedCommissionLiability: commissionLiability + itemCommissionLiability,
    staffOnTarget: staffSummaries.filter((target) => target.progressPercent >= 100).length,
    staffBelowMinimum: staffSummaries.filter((target) => target.progressPercent < 80).length,
  }
}

export function getActiveItemTargetsForStaff(staffId) {
  const staffTarget = getStaffSalesTargets().find((target) => String(target.staffId) === String(staffId))
  return (staffTarget?.itemTargets || []).filter((item) => item.isActive)
}

export function getTopProductPushers(limit = 3) {
  return getStaffSalesTargets()
    .flatMap((staffTarget) => (staffTarget.itemTargets || [])
      .filter((item) => item.isActive)
      .map((item) => {
        const progress = calculateItemProgress(item)
        const commission = calculateItemCommission(item)
        return {
          staffId: staffTarget.staffId,
          staffName: staffTarget.staffName,
          role: staffTarget.role,
          item,
          ...progress,
          estimatedItemCommission: commission.reward,
        }
      }))
    .sort((a, b) => b.progressPercent - a.progressPercent || b.estimatedItemCommission - a.estimatedItemCommission || a.item.itemName.localeCompare(b.item.itemName))
    .slice(0, limit)
}

export { SALES_TARGETS_KEY }
