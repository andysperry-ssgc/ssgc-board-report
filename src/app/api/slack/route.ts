import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCurrentCycle, getSubmissionStatus } from '@/lib/cycles'
import { getSetting, getAllSettings } from '@/lib/db'
import {
  postSlackMessage,
  recordMessageSent,
  hasMessageBeenSent,
  DEFAULT_TEMPLATES,
  renderTemplate,
  getTemplateVars,
} from '@/lib/slack'
import type { SlackMessageType } from '@/types'

const TEMPLATE_KEY = (type: SlackMessageType) => `slack_msg_${type}`

/** Resolve the template for a message type — custom override or default. */
function resolveTemplate(type: SlackMessageType, settings: Record<string, string>): string {
  return settings[TEMPLATE_KEY(type)] ?? DEFAULT_TEMPLATES[type]
}

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
    if (!cycle) return NextResponse.json({ previews: [], templates: {}, cycle: null })

    const statuses = await getSubmissionStatus(cycle.id)
    const submissionUrl = (await getSetting('submission_url')) ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const settings = await getAllSettings()
    const vars = getTemplateVars(cycle.label, submissionUrl, statuses)

    const messageTypes: SlackMessageType[] = [
      'opening', 'reminder_1', 'reminder_2', 'reminder_3',
      'final_warning', 'last_call', 'celebration', 'closed',
    ]

    const previews = await Promise.all(
      messageTypes.map(async (type) => {
        const sent     = await hasMessageBeenSent(cycle.id, type)
        const template = resolveTemplate(type, settings)
        const text     = renderTemplate(template, vars)
        const isCustom = !!settings[TEMPLATE_KEY(type)]
        return { type, text, template, isCustom, sent }
      })
    )

    // Return templates map (custom if set, default otherwise) for the edit UI
    const templates = Object.fromEntries(
      messageTypes.map(type => [type, resolveTemplate(type, settings)])
    )

    return NextResponse.json({ previews, templates, cycle })
  } catch (err) {
    console.error('GET /api/slack error:', err)
    return NextResponse.json({ error: 'Failed to load Slack previews' }, { status: 500 })
  }
}
