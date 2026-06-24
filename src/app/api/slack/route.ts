import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCurrentCycle, getSubmissionStatus } from '@/lib/cycles'
import { getSetting, getAllSettings } from '@/lib/db'
import {
  postSlackMessage,
  recordMessageSent,
  hasMessageBeenSent,
} from '@/lib/slack'
import { renderTemplate, getTemplateVars, resolveTemplate, templateKey } from '@/lib/slack-templates'
import type { SlackMessageType } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { message_type } = body as { message_type: SlackMessageType }

    const cycle = await getCurrentCycle()
    if (!cycle) return NextResponse.json({ error: 'No active cycle' }, { status: 400 })

    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const settings = await getAllSettings()

    const vars = getTemplateVars(cycle.label, submissionUrl, statuses)
    const template = resolveTemplate(message_type, settings)
    const text = renderTemplate(template, vars)

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
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cycle = await getCurrentCycle()
    const settings = await getAllSettings()

    const messageTypes: SlackMessageType[] = [
      'opening', 'reminder_1', 'reminder_2', 'reminder_3',
      'final_warning', 'last_call', 'celebration', 'closed',
    ]

    // Always build previews — use placeholder vars when no cycle is active
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const vars = cycle
      ? getTemplateVars(cycle.label, submissionUrl, await getSubmissionStatus(cycle.id))
      : getTemplateVars('(cycle label)', submissionUrl, [])

    const previews = await Promise.all(
      messageTypes.map(async (type) => {
        const sent     = cycle ? await hasMessageBeenSent(cycle.id, type) : false
        const template = resolveTemplate(type, settings)
        const text     = renderTemplate(template, vars)
        const isCustom = !!settings[templateKey(type)]
        return { type, text, template, isCustom, sent }
      })
    )

    const templates = Object.fromEntries(
      messageTypes.map(type => [type, resolveTemplate(type, settings)])
    )

    return NextResponse.json({ previews, templates, cycle })
  } catch (err) {
    console.error('GET /api/slack error:', err)
    return NextResponse.json({ error: 'Failed to load Slack previews' }, { status: 500 })
  }
}
