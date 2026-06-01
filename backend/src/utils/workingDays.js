/**
 * Working-day logic for the Anjani Refill Scheduler.
 *
 * All functions accept and return plain JS Date objects (time components ignored).
 * Weeks are Mon–Sat working days; Sunday is always a rest day.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Return a new Date stripped to midnight local time. */
function toDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSunday(date) {
  return toDay(date).getDay() === 0;
}

function isSaturday(date) {
  return toDay(date).getDay() === 6;
}

/** Mon–Sat are working days; Sunday is not. */
function isWorkingDay(date) {
  return !isSunday(date);
}

function getPreviousWorkingDay(date) {
  let d = toDay(date);
  do {
    d = new Date(d - DAY);
  } while (!isWorkingDay(d));
  return d;
}

function getNextWorkingDay(date) {
  let d = toDay(date);
  do {
    d = new Date(d.getTime() + DAY);
  } while (!isWorkingDay(d));
  return d;
}

/**
 * Subtract `n` working days from `date` (skipping Sundays).
 * Saturday counts as a working day unless it is the anchor itself.
 */
function subtractWorkingDays(date, n) {
  let d = toDay(date);
  let remaining = n;
  while (remaining > 0) {
    d = new Date(d - DAY);
    if (isWorkingDay(d)) remaining--;
  }
  return d;
}

/**
 * Return the command-start date for a given refill date.
 *
 * Rules:
 *   - Weekend refill (Sat/Sun) → command starts the preceding Wednesday.
 *   - Normal refill → 4 working days before the refill date.
 */
function calculateCommandStartDate(refillDate) {
  const d = toDay(refillDate);

  if (isSaturday(d) || isSunday(d)) {
    // Walk back to the preceding Wednesday (day 3)
    let candidate = new Date(d - DAY);
    while (candidate.getDay() !== 3) {
      candidate = new Date(candidate - DAY);
    }
    return candidate;
  }

  return subtractWorkingDays(d, 4);
}

/**
 * Compute all workflow dates for a refill.
 *
 * Workflow steps and their offsets from the refill date:
 *   stockCheck    – 4 working days before
 *   reorder       – 3 working days before
 *   verification  – 2 working days before
 *   salesCall     – 1 working day before
 *   dispatch      – refill date (or previous working day if Sunday)
 *
 * Any step that lands on a Sunday is moved to the previous working day.
 * For weekend refills the whole sequence is anchored so stock is ready by Friday.
 *
 * Returns an object with Date values for each step plus the commandStart.
 */
function calculateWorkflowDates(refillDate) {
  const raw = toDay(refillDate);

  // For weekend refills treat the effective refill as the Friday before.
  let effectiveRefill;
  let isWeekendRefill = false;

  if (isSunday(raw)) {
    // Sunday refill → dispatch on Saturday (day before)
    effectiveRefill = new Date(raw - DAY); // Saturday
    isWeekendRefill = true;
  } else if (isSaturday(raw)) {
    effectiveRefill = raw; // Saturday is a working day
    isWeekendRefill = true;
  } else {
    effectiveRefill = raw;
  }

  // Ensure dispatch never falls on Sunday
  const dispatch = isSunday(effectiveRefill)
    ? getPreviousWorkingDay(effectiveRefill)
    : effectiveRefill;

  // Build each step by subtracting working days from the effective refill date
  const steps = {
    stockCheck:   subtractWorkingDays(effectiveRefill, 4),
    reorder:      subtractWorkingDays(effectiveRefill, 3),
    verification: subtractWorkingDays(effectiveRefill, 2),
    salesCall:    subtractWorkingDays(effectiveRefill, 1),
    dispatch,
  };

  // Shift any step that lands on Sunday to the previous working day
  for (const key of Object.keys(steps)) {
    if (isSunday(steps[key])) {
      steps[key] = getPreviousWorkingDay(steps[key]);
    }
  }

  const commandStart = calculateCommandStartDate(raw);

  return {
    refillDate:   raw,
    isWeekendRefill,
    commandStart,
    ...steps,
  };
}

// ---------------------------------------------------------------------------
// Inline sanity checks — safe to run with: node src/utils/workingDays.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  const fmt = (d) => d.toDateString();

  const cases = [
    { label: "Normal weekday — Tuesday 3 Jun 2025", date: new Date("2025-06-03") },
    { label: "Saturday refill — 7 Jun 2025",        date: new Date("2025-06-07") },
    { label: "Sunday refill   — 8 Jun 2025",        date: new Date("2025-06-08") },
  ];

  for (const { label, date } of cases) {
    console.log(`\n=== ${label} ===`);
    const w = calculateWorkflowDates(date);
    console.log(`  commandStart : ${fmt(w.commandStart)}`);
    console.log(`  stockCheck   : ${fmt(w.stockCheck)}`);
    console.log(`  reorder      : ${fmt(w.reorder)}`);
    console.log(`  verification : ${fmt(w.verification)}`);
    console.log(`  salesCall    : ${fmt(w.salesCall)}`);
    console.log(`  dispatch     : ${fmt(w.dispatch)}`);
    console.log(`  refillDate   : ${fmt(w.refillDate)}  (isWeekend: ${w.isWeekendRefill})`);
  }
}

module.exports = {
  isSunday,
  isSaturday,
  isWorkingDay,
  getPreviousWorkingDay,
  getNextWorkingDay,
  calculateCommandStartDate,
  calculateWorkflowDates,
};
