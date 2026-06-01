export const DAILY_ROUTINE_STAFF = [
  {
    name: 'Virendra Singh',
    role: 'Opening + Counter Control',
    timing: '8:00 AM - 6:30 PM',
    responsibility: 'Opening setup, counter sales, shortage noting, rack discipline.',
    checklist: [
      'Opening setup completed before 9 AM',
      'POS/printer/rack readiness checked',
      'Shortage items noted during opening/low time',
      'Rack discipline maintained',
      'Counter delay avoided during rush',
      'Near-stock-out items communicated to purchase',
      'Opening area cleanliness checked',
    ],
  },
  {
    name: 'Naveen',
    role: 'Opening + Customer Support',
    timing: '8:00 AM - 6:30 PM',
    responsibility: 'Pending orders, customer follow-up, refill calls, delivery follow-up.',
    checklist: [
      'Pending orders checked',
      'Minimum 20 customer follow-ups/messages/calls completed',
      'Refill calls to regular chronic patients completed',
      'Delivery follow-up updated',
      'Customer pending status updated',
      'Lost sales/customer demand noted',
      'Low-time customer callback list completed',
    ],
  },
  {
    name: 'Rakesh Kumar Meena',
    role: 'Sales Manager',
    timing: '10:00 AM - 8:30 PM',
    responsibility: 'Sales floor control, average bill value, staff discipline, daily sales report.',
    checklist: [
      'Daily sales report prepared',
      'Staff discipline checked',
      '10-15 high-value/repeat customer follow-ups completed',
      'Lost sales reviewed',
      'Floor supervision done during rush',
      'RGHS bill/document checking reviewed',
      'Average bill value improvement checked',
    ],
  },
  {
    name: 'Aditya Parashar',
    role: 'Evening Counter + Closing Support',
    timing: '12:00 PM - 10:30 PM',
    responsibility: 'Evening counter sales, pending order follow-up, closing support.',
    checklist: [
      'Evening pending orders followed',
      'Late customer requirements recorded',
      'Closing support completed',
      'Next-day pending needs noted',
      'Evening counter handled without delay',
      'Rack/product arrangement checked before closing',
      'Customer requirements after 8 PM noted',
    ],
  },
  {
    name: 'Vakil Gurjar',
    role: 'Purchase Manager',
    timing: '12:00 PM - 10:30 PM',
    responsibility: 'Purchase order, shortage prevention, supplier rate comparison, expiry replacement claims.',
    checklist: [
      'Purchase order prepared',
      'Supplier rate comparison done before PO',
      'Zero-stock prevention checked',
      'Expiry replacement/claims tracked',
      'Shortage list reviewed',
      'Near-stock-out list checked',
      'Supplier follow-up completed',
    ],
  },
  {
    name: 'Raj Laxkar',
    role: 'Daily Accounts / Accountant',
    timing: 'Split duty around 2:00 PM and 9:45 PM daily',
    responsibility: '2 PM cash handover, wholesaler management, 9:45 PM closing, cash verification and overtime verification.',
    checklist: [
      '2 PM cash handover completed',
      'Wholesaler updates completed',
      '9:45 PM final cash verification completed',
      'Overtime verification completed',
      'Account/cash mismatch noted if any',
      'Pending bills/accounts reviewed',
      'Closing account status updated',
    ],
  },
]

export const FREE_TIME_PRIORITIES = [
  'Pending customer order follow-up',
  'Refill calls to regular chronic patients',
  'Shortage and near-stock-out list',
  'Purchase rate comparison before PO',
  'Expiry and near-expiry checking',
  'Random stock audit - 20 items/day',
  'RGHS bill/document checking',
  'Rack cleaning and product arrangement',
]

export const REPORT_FIELDS = [
  { key: 'salesWork', label: 'Sales Work' },
  { key: 'backendWork', label: 'Backend Work' },
  { key: 'callsFollowup', label: 'Calls/Follow-up' },
  { key: 'shortageFound', label: 'Shortage Found' },
  { key: 'mistakeLoss', label: 'Mistake/Loss' },
  { key: 'overtime', label: 'Overtime' },
]

function pad(n) {
  return String(n).padStart(2, '0')
}

export function routineDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dailyRoutineStorageKey(date = new Date()) {
  return `dailyRoutineChecklist-${routineDateKey(date)}`
}

export function getShiftFocus(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes >= 8 * 60 && minutes < 9 * 60) return 'Opening Preparation'
  if (minutes >= 9 * 60 && minutes < 13 * 60) return 'Rush Time - Counter Sales Focus'
  if (minutes >= 13 * 60 && minutes < 16 * 60) return 'Low Time - Backend Work Compulsory'
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'Evening Rush - Counter Focus'
  if (minutes >= 20 * 60 && minutes < 22 * 60 + 30) return 'Closing + Backend Work'
  return 'Off-hours / Preparation'
}

export function readDailyRoutineState(date = new Date()) {
  try {
    const raw = localStorage.getItem(dailyRoutineStorageKey(date))
    if (!raw) return { checks: {}, report: {} }
    const parsed = JSON.parse(raw)
    return {
      checks: parsed?.checks && typeof parsed.checks === 'object' ? parsed.checks : {},
      report: parsed?.report && typeof parsed.report === 'object' ? parsed.report : {},
    }
  } catch {
    return { checks: {}, report: {} }
  }
}

export function writeDailyRoutineState(state, date = new Date()) {
  localStorage.setItem(dailyRoutineStorageKey(date), JSON.stringify(state))
}

export function routineProgressFor(staff, checks = {}) {
  const completed = (checks[staff.name] || []).filter(Boolean).length
  const total = staff.checklist.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}

export function routineStatus(percent) {
  if (percent === 100) return 'On Track'
  if (percent >= 50) return 'Pending'
  return 'Needs Attention'
}

export function getDailyRoutineSummary(date = new Date()) {
  const state = readDailyRoutineState(date)
  const totals = DAILY_ROUTINE_STAFF.reduce((acc, staff) => {
    const progress = routineProgressFor(staff, state.checks)
    acc.completed += progress.completed
    acc.total += progress.total
    if (progress.percent < 50) acc.needsAttention += 1
    return acc
  }, { completed: 0, total: 0, needsAttention: 0 })

  return {
    ...totals,
    percent: totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0,
  }
}
