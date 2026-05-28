/**
 * Auto-scheduling helpers for biweekly board report cycles.
 *
 * Anchor: Monday June 1, 2026 — every 14 days after that.
 * Opens:  Monday  14:00 UTC  (matches existing cron opening message time)
 * Closes: Wednesday 22:00 UTC (≈ 4–5pm CT depending on DST)
 *
 * The cycle LABEL represents the two-week reporting period immediately
 * preceding the submission window (i.e. the work period people are reporting on).
 * Example: opens June 1 → covers May 18–29 → label "May 18 – 29"
 */

// The first Monday on which a cycle should auto-open (UTC midnight)
const ANCHOR_DATE = new Date(Date.UTC(2026, 4, 18)) // May 18, 2026 (2 weeks before Jun 1)
// Note: anchor is May 18 so that the FIRST auto-cycle opens June 1 (anchor + 14 days)
// This means June 1 is the first "opens" date in the schedule.

export const FIRST_OPEN_DATE = new Date(Date.UTC(2026, 5, 1)) // June 1, 2026

/** UTC hour the cycle opens (Monday) — matches the cron opening message time */
export const OPEN_UTC_HOUR = 14

/** UTC hour the cycle closes (Wednesday) */
export const CLOSE_UTC_HOUR = 22

/**
 * Returns true if `now` is the exact UTC hour a new cycle should auto-open
 * (i.e. a Monday at OPEN_UTC_HOUR that falls on a biweekly schedule).
 */
export function isScheduledCycleMonday(now: Date): boolean {
  if (now.getUTCDay() !== 1) return false // Must be Monday
  if (now.getUTCHours() !== OPEN_UTC_HOUR) return false

  const anchorMs = FIRST_OPEN_DATE.getTime()
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysDiff = Math.round((nowDay - anchorMs) / 86_400_000)

  return daysDiff >= 0 && daysDiff % 14 === 0
}

/** The opens_at timestamp for a cycle starting on `monday` */
export function getOpenTime(monday: Date): Date {
  return new Date(Date.UTC(
    monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(),
    OPEN_UTC_HOUR, 0, 0, 0,
  ))
}

/** The closes_at timestamp for a cycle starting on `monday` (same-week Wednesday) */
export function getCloseTime(monday: Date): Date {
  return new Date(Date.UTC(
    monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 2,
    CLOSE_UTC_HOUR, 0, 0, 0,
  ))
}

/**
 * Build the human-readable period label for a cycle that opens on `openMonday`.
 * The label covers the two weeks of work BEFORE the submission window:
 *   period_start = openMonday − 14 days
 *   period_end   = openMonday − 3 days (Friday)
 */
export function buildAutoLabel(openMonday: Date): string {
  const start = new Date(Date.UTC(
    openMonday.getUTCFullYear(), openMonday.getUTCMonth(), openMonday.getUTCDate() - 14,
  ))
  const end = new Date(Date.UTC(
    openMonday.getUTCFullYear(), openMonday.getUTCMonth(), openMonday.getUTCDate() - 3,
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

/**
 * Returns the next `count` upcoming cycle open dates on or after `from`.
 * Safe to call client-side (pure date math, no DB).
 */
export function getUpcomingCycleDates(count: number, from: Date = new Date()): Date[] {
  const anchorMs = FIRST_OPEN_DATE.getTime()
  const fromMs   = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const daysDiff = Math.ceil((fromMs - anchorMs) / 86_400_000)
  const startPeriod = Math.max(0, Math.ceil(daysDiff / 14))

  const results: Date[] = []
  for (let i = 0; i < count; i++) {
    const days = (startPeriod + i) * 14
    const d = new Date(FIRST_OPEN_DATE)
    d.setUTCDate(d.getUTCDate() + days)
    results.push(d)
  }
  return results
}
