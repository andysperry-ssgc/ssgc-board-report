import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCycle, getSubmissionStatus, allSubmitted, createCycle, closeCycle } from '@/lib/cycles'
import { getSetting } from '@/lib/db'
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
  buildOpeningMessage,
  buildReminderMessage,
  buildFinalWarningMessage,
  buildLastCallMessage,
  buildCelebrationMessage,
  buildClosedMessage,
} from '@/lib/slack'

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

    // ── Guard: only send messages Mon–Wed of the cycle's opening week ────────
    const cycleOpenDay = Date.UTC(
      new Date(cycle.opens_at).getUTCFullYear(),
      new Date(cycle.opens_at).getUTCMonth(),
      new Date(cycle.opens_at).getUTCDate(),
    )
    const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const daysSinceOpen = Math.floor((nowDay - cycleOpenDay) / 86_400_000)
    if (daysSinceOpen < 0 || daysSinceOpen > 2) {
      return NextResponse.json({ message: 'Outside cycle window' })
    }

    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const cycleLabel = cycle.label

    // ── All submitted → celebrate and cancel remaining ───────────────────────
    if (allSubmitted(statuses)) {
      const celebrationSent = await hasMessageBeenSent(cycle.id, 'celebration')
      if (!celebrationSent) {
        await cancelRemainingMessages(cycle.id)
        const ts = await postSlackMessage(buildCelebrationMessage(statuses))
        await recordMessageSent(cycle.id, 'celebration', ts)
        return NextResponse.json({ message: 'Celebration sent', sent: 'celebration' })
      }
      return NextResponse.json({ message: 'All submitted, celebration already sent' })
    }

    // ── Scheduled messages (CT times) ────────────────────────────────────────
    let sent: string | null = null

    if (atCT(now, 1, 8)) {
      // Monday 8am — opening
      if (!(await hasMessageBeenSent(cycle.id, 'opening'))) {
        const ts = await postSlackMessage(buildOpeningMessage(cycleLabel, submissionUrl))
        await recordMessageSent(cycle.id, 'opening', ts)
        sent = 'opening'
      }
    } else if (atCT(now, 1, 16)) {
      // Monday 4pm — reminder 1
      if (!(await hasMessageBeenSent(cycle.id, 'reminder_1'))) {
        const ts = await postSlackMessage(buildReminderMessage(cycleLabel, submissionUrl, statuses, 1))
        await recordMessageSent(cycle.id, 'reminder_1', ts)
        sent = 'reminder_1'
      }
    } else if (atCT(now, 2, 11)) {
      // Tuesday 11am — reminder 2
      if (!(await hasMessageBeenSent(cycle.id, 'reminder_2'))) {
        const ts = await postSlackMessage(buildReminderMessage(cycleLabel, submissionUrl, statuses, 2))
        await recordMessageSent(cycle.id, 'reminder_2', ts)
        sent = 'reminder_2'
      }
    } else if (atCT(now, 2, 16)) {
      // Tuesday 4pm — reminder 3
      if (!(await hasMessageBeenSent(cycle.id, 'reminder_3'))) {
        const ts = await postSlackMessage(buildReminderMessage(cycleLabel, submissionUrl, statuses, 3))
        await recordMessageSent(cycle.id, 'reminder_3', ts)
        sent = 'reminder_3'
      }
    } else if (atCT(now, 3, 7)) {
      // Wednesday 7am — final warning (2 hrs before 9am deadline)
      if (!(await hasMessageBeenSent(cycle.id, 'final_warning'))) {
        const ts = await postSlackMessage(buildFinalWarningMessage(cycleLabel, submissionUrl, statuses))
        await recordMessageSent(cycle.id, 'final_warning', ts)
        sent = 'final_warning'
      }
    } else if (atCT(now, 3, 8)) {
      // Wednesday 8am — last call (1 hr before 9am deadline)
      if (!(await hasMessageBeenSent(cycle.id, 'last_call'))) {
        const ts = await postSlackMessage(buildLastCallMessage(cycleLabel, submissionUrl, statuses))
        await recordMessageSent(cycle.id, 'last_call', ts)
        sent = 'last_call'
      }
    } else if (atCT(now, 3, 9)) {
      // Wednesday 9am — closed / submissions closed
      if (!(await hasMessageBeenSent(cycle.id, 'closed'))) {
        const ts = await postSlackMessage(buildClosedMessage(cycleLabel, submissionUrl, statuses))
        await recordMessageSent(cycle.id, 'closed', ts)
        sent = 'closed'
      }
    }

    // ── Auto-close expired cycle (runs last so closed message fires first) ────
    if (now > new Date(cycle.closes_at)) {
      await closeCycle(cycle.id)
      console.log(`[cron] Auto-closed expired cycle: ${cycle.label}`)
    }

    return NextResponse.json({ message: sent ? `Sent ${sent}` : 'No action needed', sent })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
