import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCurrentCycle, getSubmissionStatus } from '@/lib/cycles'
import { getSetting } from '@/lib/db'
import {
  postSlackMessage,
  recordMessageSent,
  hasMessageBeenSent,
  buildOpeningMessage,
  buildReminderMessage,
  buildFinalWarningMessage,
  buildLastCallMessage,
  buildCelebrationMessage,
  buildClosedMessage,
} from '@/lib/slack'
import type { SlackMessageType } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { message_type, preview_only } = body as { message_type: SlackMessageType; preview_only?: boolean }

    const cycle = await getCurrentCycle()
    if (!cycle) {
      return NextResponse.json({ error: 'No active cycle' }, { status: 400 })
    }

    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.vercel.app'
    const cycleLabel = cycle.label

    let text = ''
    switch (message_type) {
      case 'opening':
        text = buildOpeningMessage(cycleLabel, submissionUrl)
        break
      case 'reminder_1':
        text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 1)
        break
      case 'reminder_2':
        text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 2)
        break
      case 'reminder_3':
        text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 3)
        break
      case 'final_warning':
        text = buildFinalWarningMessage(cycleLabel, submissionUrl, statuses)
        break
      case 'last_call':
        text = buildLastCallMessage(cycleLabel, submissionUrl, statuses)
        break
      case 'celebration':
        text = buildCelebrationMessage(statuses)
        break
      case 'closed':
        text = buildClosedMessage(cycleLabel)
        break
      default:
        return NextResponse.json({ error: 'Unknown message type' }, { status: 400 })
    }

    if (preview_only) {
      return NextResponse.json({ text })
    }

    const ts = await postSlackMessage(text)
    await recordMessageSent(cycle.id, message_type, ts)

    return NextResponse.json({ success: true, ts, text })
  } catch (err) {
    console.error('POST /api/slack error:', err)
    return NextResponse.json({ error: 'Failed to send Slack message' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cycle = await getCurrentCycle()
    if (!cycle) {
      return NextResponse.json({ messages: [] })
    }

    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const cycleLabel = cycle.label

    const messageTypes: SlackMessageType[] = [
      'opening', 'reminder_1', 'reminder_2', 'reminder_3',
      'final_warning', 'last_call', 'celebration', 'closed',
    ]

    const previews = await Promise.all(
      messageTypes.map(async (type) => {
        const sent = await hasMessageBeenSent(cycle.id, type)
        let text = ''
        switch (type) {
          case 'opening': text = buildOpeningMessage(cycleLabel, submissionUrl); break
          case 'reminder_1': text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 1); break
          case 'reminder_2': text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 2); break
          case 'reminder_3': text = buildReminderMessage(cycleLabel, submissionUrl, statuses, 3); break
          case 'final_warning': text = buildFinalWarningMessage(cycleLabel, submissionUrl, statuses); break
          case 'last_call': text = buildLastCallMessage(cycleLabel, submissionUrl, statuses); break
          case 'celebration': text = buildCelebrationMessage(statuses); break
          case 'closed': text = buildClosedMessage(cycleLabel); break
        }
        return { type, text, sent }
      })
    )

    return NextResponse.json({ previews, cycle })
  } catch (err) {
    console.error('GET /api/slack error:', err)
    return NextResponse.json({ error: 'Failed to load Slack previews' }, { status: 500 })
  }
}
