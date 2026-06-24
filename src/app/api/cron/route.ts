import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCycle, getSubmissionStatus, allSubmitted, createCycle, closeCycle } from '@/lib/cycles'
import { getSetting, getAllSettings } from '@/lib/db'
import {
  isScheduledCycleMonday,
  getOpenTime,
  getCloseTime,
  buildAutoLabel,
  getCTDayHour,
} from '@/lib/auto-schedule'
import {
  postSlackMessage,
  recordMessageSent,
  hasMessageBeenSent,
  cancelRemainingMessages,
  renderMessage,
} from '@/lib/slack'
import type { SlackMessageType } from '@/types'

// Biweekly Slack schedule — all times CT (DST-aware):
// Mon  8:00 am → opening
// Mon  4:00 pm → reminder_1
// Tue 11:00 am → reminder_2
// Tue  4:00 pm → reminder_3
// Wed  7:00 am → final_warning  (2 hrs before 9am deadline)
// Wed  8:00 am → last_call      (1 hr before 9am deadline)
// Wed  9:00 am → closed / submissions closed (cycle closes_at; report compiled by Andy for approval)

/** True when `now` (CT) matches the given CT day-of-week and CT hour. */
function atCT(now: Date, ctDay: number, ctHour: number): boolean {
  const { day, hour } = getCTDayHour(now)
  return day === ctDay && hour === ctHour
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // ── Auto-create cycle ────────────────────────────────────────────────────
    if (isScheduledCycleMonday(now)) {
      const existing = await getCurrentCycle()
      if (!existing) {
        const opensAt  = getOpenTime(now)
        const closesAt = getCloseTime(now)
        const label    = buildAutoLabel(now)
        await createCycle(label, 'biweekly', opensAt, closesAt)
        console.log(`[cron] Auto-created cycle: ${label}`)
      }
    }

    // ── Guard: need an active cycle ──────────────────────────────────────────
    const cycle = await getCurrentCycle()
    if (!cycle) {
      return NextResponse.json({ message: 'No active cycle' })
    }

    // Auto-close runs on every path below so an early-completed cycle still
    // closes (and the next biweekly cycle can be auto-created).
    async function autoCloseIfExpired() {
      if (now > new Date(cycle!.closes_at)) {
        await closeCycle(cycle!.id)
        console.log(`[cron] Auto-closed expired cycle: ${cycle!.label}`)
      }
    }

    // ── Guard: only send messages Mon–Wed of the cycle's opening week ────────
    const cycleOpenDay = Date.UTC(
      new Date(cycle.opens_at).getUTCFullYear(),
      new Date(cycle.opens_at).getUTCMonth(),
      new Date(cycle.opens_at).getUTCDate(),
    )
    const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const daysSinceOpen = Math.floor((nowDay - cycleOpenDay) / 86_400_000)
    if (daysSinceOpen < 0 || daysSinceOpen > 2) {
      // Still close out a cycle whose window has fully passed.
      await autoCloseIfExpired()
      return NextResponse.json({ message: 'Outside cycle window' })
    }

    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const settings = await getAllSettings()
    const cycleLabel = cycle.label

    // Render through the shared resolver so custom template overrides apply.
    const send = (type: SlackMessageType) =>
      postSlackMessage(renderMessage(type, settings, cycleLabel, submissionUrl, statuses))

    // ── All submitted → celebrate and cancel remaining ───────────────────────
    if (allSubmitted(statuses)) {
      let sent: string | null = null
      if (!(await hasMessageBeenSent(cycle.id, 'celebration'))) {
        await cancelRemainingMessages(cycle.id)
        const ts = await send('celebration')
        await recordMessageSent(cycle.id, 'celebration', ts)
        sent = 'celebration'
      }
      await autoCloseIfExpired()
      return NextResponse.json({
        message: sent ? 'Celebration sent' : 'All submitted, celebration already sent',
        sent,
      })
    }

    // ── Scheduled messages (CT times) ────────────────────────────────────────
    let sent: string | null = null

    async function sendOnce(type: SlackMessageType) {
      if (!(await hasMessageBeenSent(cycle!.id, type))) {
        const ts = await send(type)
        await recordMessageSent(cycle!.id, type, ts)
        sent = type
      }
    }

    if (atCT(now, 1, 8)) {
      await sendOnce('opening')        // Monday 8am — opening
    } else if (atCT(now, 1, 16)) {
      await sendOnce('reminder_1')     // Monday 4pm — reminder 1
    } else if (atCT(now, 2, 11)) {
      await sendOnce('reminder_2')     // Tuesday 11am — reminder 2
    } else if (atCT(now, 2, 16)) {
      await sendOnce('reminder_3')     // Tuesday 4pm — reminder 3
    } else if (atCT(now, 3, 7)) {
      await sendOnce('final_warning')  // Wednesday 7am — final warning (2 hrs before 9am)
    } else if (atCT(now, 3, 8)) {
      await sendOnce('last_call')      // Wednesday 8am — last call (1 hr before 9am)
    } else if (atCT(now, 3, 9)) {
      await sendOnce('closed')         // Wednesday 9am — closed / submissions closed
    }

    // ── Auto-close expired cycle (runs after closed message so it fires first) ─
    await autoCloseIfExpired()

    return NextResponse.json({ message: sent ? `Sent ${sent}` : 'No action needed', sent })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
