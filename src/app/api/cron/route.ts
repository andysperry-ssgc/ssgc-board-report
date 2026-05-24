import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCycle, getSubmissionStatus, allSubmitted } from '@/lib/cycles'
import { getSetting } from '@/lib/db'
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

// Biweekly schedule (CT times converted to UTC hours):
// Mon 08:00 CT = Mon 14:00 UTC → opening
// Mon 16:00 CT = Mon 22:00 UTC → reminder_1
// Tue 11:00 CT = Tue 17:00 UTC → reminder_2
// Tue 16:00 CT = Tue 22:00 UTC → reminder_3
// Wed 08:00 CT = Wed 14:00 UTC → final_warning
// Wed 14:00 CT = Wed 20:00 UTC → last_call
// Wed 22:00 CT = Wed 22:00 UTC → (submissions close — handled by cycle closes_at)
// Wed 23:00 CT = Wed 23:00 UTC → closed

function matchesSchedule(now: Date, dayOfWeek: number, utcHour: number): boolean {
  return now.getUTCDay() === dayOfWeek && now.getUTCHours() === utcHour
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cycle = await getCurrentCycle()
    if (!cycle) {
      return NextResponse.json({ message: 'No active cycle' })
    }

    const now = new Date()
    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const cycleLabel = cycle.label

    // Check if all submitted — send celebration if any reminder not yet sent
    if (allSubmitted(statuses)) {
      const celebrationSent = await hasMessageBeenSent(cycle.id, 'celebration')
      if (!celebrationSent) {
        await cancelRemainingMessages(cycle.id)
        const text = buildCelebrationMessage(statuses)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'celebration', ts)
        return NextResponse.json({ message: 'Celebration message sent', sent: 'celebration' })
      }
      return NextResponse.json({ message: 'All submitted, celebration already sent' })
    }

    // Determine which message to send based on current time
    // Cycle opens on Monday — check if this is a cycle Monday
    const cycleOpens = new Date(cycle.opens_at)
    const cycleMonday = new Date(cycleOpens)
    cycleMonday.setUTCHours(0, 0, 0, 0)

    // Calculate which week day we're in relative to the cycle
    const daysSinceOpen = Math.floor((now.getTime() - cycleMonday.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceOpen < 0 || daysSinceOpen > 2) {
      return NextResponse.json({ message: 'Outside cycle window' })
    }

    let sent: string | null = null

    // Monday 14:00 UTC (08:00 CT) — opening
    if (matchesSchedule(now, cycleMonday.getUTCDay(), 14)) {
      if (!(await hasMessageBeenSent(cycle.id, 'opening'))) {
        const text = buildOpeningMessage(cycleLabel, submissionUrl)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'opening', ts)
        sent = 'opening'
      }
    }
    // Monday 22:00 UTC (16:00 CT) — reminder_1
    else if (matchesSchedule(now, cycleMonday.getUTCDay(), 22)) {
      if (!(await hasMessageBeenSent(cycle.id, 'reminder_1'))) {
        const text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 1)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'reminder_1', ts)
        sent = 'reminder_1'
      }
    }
    // Tuesday 17:00 UTC (11:00 CT) — reminder_2
    else if (matchesSchedule(now, (cycleMonday.getUTCDay() + 1) % 7, 17)) {
      if (!(await hasMessageBeenSent(cycle.id, 'reminder_2'))) {
        const text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 2)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'reminder_2', ts)
        sent = 'reminder_2'
      }
    }
    // Tuesday 22:00 UTC (16:00 CT) — reminder_3
    else if (matchesSchedule(now, (cycleMonday.getUTCDay() + 1) % 7, 22)) {
      if (!(await hasMessageBeenSent(cycle.id, 'reminder_3'))) {
        const text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 3)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'reminder_3', ts)
        sent = 'reminder_3'
      }
    }
    // Wednesday 14:00 UTC (08:00 CT) — final_warning
    else if (matchesSchedule(now, (cycleMonday.getUTCDay() + 2) % 7, 14)) {
      if (!(await hasMessageBeenSent(cycle.id, 'final_warning'))) {
        const text = buildFinalWarningMessage(cycleLabel, submissionUrl, statuses)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'final_warning', ts)
        sent = 'final_warning'
      }
    }
    // Wednesday 20:00 UTC (14:00 CT) — last_call
    else if (matchesSchedule(now, (cycleMonday.getUTCDay() + 2) % 7, 20)) {
      if (!(await hasMessageBeenSent(cycle.id, 'last_call'))) {
        const text = buildLastCallMessage(cycleLabel, submissionUrl, statuses)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'last_call', ts)
        sent = 'last_call'
      }
    }
    // Wednesday 23:00 UTC (17:00 CT) — closed/distributed
    else if (matchesSchedule(now, (cycleMonday.getUTCDay() + 2) % 7, 23)) {
      if (!(await hasMessageBeenSent(cycle.id, 'closed'))) {
        const text = buildClosedMessage(cycleLabel)
        const ts = await postSlackMessage(text)
        await recordMessageSent(cycle.id, 'closed', ts)
        sent = 'closed'
      }
    }

    return NextResponse.json({ message: sent ? `Sent ${sent}` : 'No action needed', sent })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
