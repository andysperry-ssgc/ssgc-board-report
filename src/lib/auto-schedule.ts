/**
 * Auto-scheduling helpers for biweekly board report cycles.
 *
 * Anchor: Monday June 1, 2026 — every 14 days after that.
 * Opens:  Monday  8:00 am CT  (DST-aware UTC conversion)
 * Closes: Wednesday 4:00 pm CT
 *
 * The cycle LABEL covers the two-week reporting period immediately preceding
 * the submission window — 14 calendar days ending the Friday before opening.
 * Example: opens June 1 (Mon) → period May 16 (Sat) – May 29 (Fri) → "May 16 – 29"
 */

export const FIRST_OPEN_DATE = new Date(Date.UTC(2026, 5, 1)) // June 1, 2026 (UTC midnight)

// ── DST helpers ────────────────────────────────────────────────────────────────

function getNthSunday(year: number, month: number, n: number): Date {
  const d = new Date(year, month - 1, 1)
  const firstSunday = d.getDay() === 0 ? 1 : 8 - d.getDay()
  return new Date(year, month - 1, firstSunday + (n - 1) * 7, 2, 0, 0)
}

/** Returns the CT UTC offset for a given date: -5 (CDT) or -6 (CST) */
function getCTOffsetHours(date: Date): number {
  const year = date.getUTCFullYear()
  const dstStart = getNthSunday(year, 3, 2)  // 2nd Sunday in March
  const dstEnd   = getNthSunday(year, 11, 1) // 1st Sunday in November
  return date >= dstStart && date < dstEnd ? -5 : -6
}

// ── CT day/hour extraction (used by cron and auto-create check) ────────────────

/** Returns the CT day-of-week (0=Sun…6=Sat) and CT hour (0–23) for a UTC Date. */
export function getCTDayHour(now: Date): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0'
  const hour = parseInt(hourStr) % 24 // Intl may return 24 for midnight
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { day: dayMap[weekday] ?? 0, hour }
}

// ── Schedule check ─────────────────────────────────────────────────────────────

/**
 * Returns true if `now` is Monday at 8am CT and falls on the biweekly schedule.
 * This is the trigger for the cron to auto-create a new cycle.
 */
export function isScheduledCycleMonday(now: Date): boolean {
  const { day, hour } = getCTDayHour(now)
  if (day !== 1 || hour !== 8) return false // must be Monday 8am CT

  const anchorMs = FIRST_OPEN_DATE.getTime()
  const nowDayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysDiff = Math.round((nowDayMs - anchorMs) / 86_400_000)

  return daysDiff >= 0 && daysDiff % 14 === 0
}

// ── Cycle time builders ────────────────────────────────────────────────────────

/** 8:00 am CT on the given Monday (UTC-correct for current DST state) */
export function getOpenTime(monday: Date): Date {
  const offset = getCTOffsetHours(monday) // -5 or -6
  const utcHour = 8 - offset              // 13 (CDT) or 14 (CST)
  return new Date(Date.UTC(
    monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), utcHour, 0, 0,
  ))
}

/** 4:00 pm CT on the Wednesday of the same cycle week */
export function getCloseTime(monday: Date): Date {
  const wed = new Date(Date.UTC(
    monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 2,
  ))
  const offset = getCTOffsetHours(wed) // -5 or -6
  const utcHour = 16 - offset          // 21 (CDT) or 22 (CST)
  return new Date(Date.UTC(
    wed.getUTCFullYear(), wed.getUTCMonth(), wed.getUTCDate(), utcHour, 0, 0,
  ))
}

// ── Label builder ──────────────────────────────────────────────────────────────

/**
 * Build the human-readable period label for a cycle opening on `openMonday`.
 * Covers the 14 calendar days ending the Friday before the open date:
 *   period_end   = openMonday − 3 days  (Friday)
 *   period_start = openMonday − 16 days (Saturday, 14 days before period_end)
 *
 * Example: opens June 1 → May 16 – 29
 */
export function buildAutoLabel(openMonday: Date): string {
  // Use noon UTC so CT timezone display never rolls back to the previous day
  const start = new Date(Date.UTC(
    openMonday.getUTCFullYear(), openMonday.getUTCMonth(), openMonday.getUTCDate() - 16, 12,
  ))
  const end = new Date(Date.UTC(
    openMonday.getUTCFullYear(), openMonday.getUTCMonth(), openMonday.getUTCDate() - 3, 12,
  ))

  const tz = 'America/Chicago'
  const startMonth = start.toLocaleDateString('en-US', { timeZone: tz, month: 'short' })
  const endMonth   = end.toLocaleDateString('en-US', { timeZone: tz, month: 'short' })
  const startDay   = start.toLocaleDateString('en-US', { timeZone: tz, day: 'numeric' })
  const endDay     = end.toLocaleDateString('en-US', { timeZone: tz, day: 'numeric' })

  return startMonth === endMonth
    ? `${startMonth} ${startDay} – ${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`
}

// ── Upcoming cycle list (for Settings UI) ──────────────────────────────────────

/**
 * Returns the next `count` upcoming cycle open Mondays on or after `from`.
 * Pure date math — safe to call client-side.
 */
export function getUpcomingCycleDates(count: number, from: Date = new Date()): Date[] {
  const anchorMs = FIRST_OPEN_DATE.getTime()
  const fromMs   = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const daysDiff = Math.ceil((fromMs - anchorMs) / 86_400_000)
  const startPeriod = Math.max(0, Math.ceil(daysDiff / 14))

  const results: Date[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(FIRST_OPEN_DATE)
    d.setUTCDate(d.getUTCDate() + (startPeriod + i) * 14)
    d.setUTCHours(12, 0, 0, 0) // noon UTC — safe for CT timezone display (no midnight rollback)
    results.push(d)
  }
  return results
}
