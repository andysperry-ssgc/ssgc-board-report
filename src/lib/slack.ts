import { WebClient } from '@slack/web-api'
import { sql } from '@/lib/db'
import type { SlackMessageType, SubmissionStatus } from '@/types'
import { TEAM_MEMBERS } from './team'

// ── Template system ────────────────────────────────────────────────────────────

/**
 * Default message templates. Use {{variable}} placeholders.
 * Available vars: cycleLabel, submissionUrl, teamNames,
 *                 submittedList, pendingList, pendingNames
 */
export const DEFAULT_TEMPLATES: Record<SlackMessageType, string> = {
  opening:
`<!channel> 📋 *Board report submissions are open — {{cycleLabel}}*

Time to submit your update. Deadline is *Wednesday at 4:00 pm CT*.

👋 {{teamNames}}

Submit here: {{submissionUrl}}
_Report goes out by 5:00 pm Wednesday. Scott will distribute._`,

  reminder_1:
`<!channel> ⏰ *Board report reminder — {{cycleLabel}}* (1 of 3)

{{submittedList}}
{{pendingList}}

Deadline: *Wednesday 4:00 pm CT* | Submit: {{submissionUrl}}`,

  reminder_2:
`<!channel> 🔔 *Board report reminder — {{cycleLabel}}* (2 of 3)

{{submittedList}}
{{pendingList}}

Deadline: *Wednesday 4:00 pm CT* | Submit: {{submissionUrl}}`,

  reminder_3:
`<!channel> 📣 *Board report reminder — {{cycleLabel}}* (3 of 3)

{{submittedList}}
{{pendingList}}

Deadline: *Wednesday 4:00 pm CT* | Submit: {{submissionUrl}}`,

  final_warning:
`<!channel> 🔴 *Final warning — {{cycleLabel}}*
Submissions close at *4:00 pm CT today* (8 hours).

{{submittedList}}
⏳ *Still needed:* {{pendingNames}}

Submit now: {{submissionUrl}}`,

  last_call:
`<!channel> 🚨 *Last call — 2 hours left! {{cycleLabel}}*
Submissions close at *4:00 pm CT*.

{{submittedList}}
{{pendingList}}

Submit: {{submissionUrl}}`,

  celebration:
`🎉 *All board report submissions are in!*

{{submittedList}}

Thank you all — great work! Report will be distributed by 5:00 pm Wednesday. Scott will distribute.`,

  closed:
`📊 *{{cycleLabel}} board report is being distributed now.* Scott will distribute.`,
}

/** Replace {{variable}} placeholders in a template string. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  )
}

/** Build the variable map for template rendering. */
export function getTemplateVars(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[],
): Record<string, string> {
  const submitted = statuses.filter(s => s.submitted)
  const pending   = statuses.filter(s => !s.submitted)
  return {
    cycleLabel,
    submissionUrl,
    teamNames:     TEAM_MEMBERS.map(m => m.firstName).join(' '),
    submittedList: submitted.length === 0 ? '_None yet_' : submitted.map(s => `✅ ${s.firstName}`).join('  '),
    pendingList:   pending.length === 0   ? '_Everyone is in!_' : pending.map(s => `⏳ ${s.firstName}`).join('  '),
    pendingNames:  pending.map(s => s.name).join(', '),
  }
}

let slackClient: WebClient | null = null

function getClient(): WebClient {
  if (!slackClient) {
    slackClient = new WebClient(process.env.SLACK_BOT_TOKEN)
  }
  return slackClient
}

const CHANNEL = process.env.SLACK_CHANNEL_ID ?? '#reports'

export async function postSlackMessage(text: string): Promise<string | undefined> {
  const client = getClient()
  const result = await client.chat.postMessage({
    channel: CHANNEL,
    text,
    mrkdwn: true,
  })
  return result.ts as string | undefined
}

function submittedList(statuses: SubmissionStatus[]): string {
  const submitted = statuses.filter((s) => s.submitted)
  if (submitted.length === 0) return '_None yet_'
  return submitted.map((s) => `✅ ${s.firstName}`).join('  ')
}

function pendingList(statuses: SubmissionStatus[]): string {
  const pending = statuses.filter((s) => !s.submitted)
  if (pending.length === 0) return '_Everyone is in!_'
  return pending.map((s) => `⏳ ${s.firstName}`).join('  ')
}

export function buildOpeningMessage(cycleLabel: string, submissionUrl: string): string {
  const tags = TEAM_MEMBERS.map((m) => m.firstName).join(' ')
  return `<!channel> 📋 *Board report submissions are open — ${cycleLabel}*

Time to submit your update. Deadline is *Wednesday at 4:00 pm CT*.

👋 ${tags}

Submit here: ${submissionUrl}
_Report goes out by 5:00 pm Wednesday. Scott will distribute._`
}

export function buildReminderMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[],
  messageNum: 1 | 2 | 3
): string {
  const emoji = messageNum === 1 ? '⏰' : messageNum === 2 ? '🔔' : '📣'
  return `<!channel> ${emoji} *Board report reminder — ${cycleLabel}* (${messageNum} of 3)

${submittedList(statuses)}
${pendingList(statuses)}

Deadline: *Wednesday 4:00 pm CT* | Submit: ${submissionUrl}`
}

export function buildFinalWarningMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[]
): string {
  const pending = statuses.filter((s) => !s.submitted)
  const pendingNames = pending.map((s) => s.name).join(', ')
  return `<!channel> 🔴 *Final warning — ${cycleLabel}*
Submissions close at *4:00 pm CT today* (8 hours).

${submittedList(statuses)}
⏳ *Still needed:* ${pendingNames}

Submit now: ${submissionUrl}`
}

export function buildLastCallMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[]
): string {
  return `<!channel> 🚨 *Last call — 2 hours left! ${cycleLabel}*
Submissions close at *4:00 pm CT*.

${submittedList(statuses)}
${pendingList(statuses)}

Submit: ${submissionUrl}`
}

export function buildCelebrationMessage(statuses: SubmissionStatus[]): string {
  const allNames = statuses.map((s) => `✅ ${s.firstName}`).join('  ')
  return `🎉 *All board report submissions are in!*

${allNames}

Thank you all — great work! Report will be distributed by 5:00 pm Wednesday. Scott will distribute.`
}

export function buildClosedMessage(cycleLabel: string): string {
  return `📊 *${cycleLabel} board report is being distributed now.* Scott will distribute.`
}

export async function hasMessageBeenSent(
  cycleId: number,
  messageType: SlackMessageType
): Promise<boolean> {
  const result = await sql`
    SELECT id FROM slack_messages
    WHERE cycle_id = ${cycleId} AND message_type = ${messageType} AND cancelled = false
  `
  return result.rows.length > 0
}

export async function recordMessageSent(
  cycleId: number,
  messageType: SlackMessageType,
  ts?: string
): Promise<void> {
  await sql`
    INSERT INTO slack_messages (cycle_id, message_type, ts, posted_at)
    VALUES (${cycleId}, ${messageType}, ${ts ?? null}, NOW())
  `
}

export async function cancelRemainingMessages(cycleId: number): Promise<void> {
  await sql`
    UPDATE slack_messages SET cancelled = true
    WHERE cycle_id = ${cycleId} AND cancelled = false
  `
  // Insert cancellation markers for all unsent reminder types
  const types: SlackMessageType[] = ['reminder_1', 'reminder_2', 'reminder_3', 'final_warning', 'last_call']
  for (const type of types) {
    const alreadySent = await hasMessageBeenSent(cycleId, type)
    if (!alreadySent) {
      await sql`
        INSERT INTO slack_messages (cycle_id, message_type, cancelled)
        VALUES (${cycleId}, ${type}, true)
      `
    }
  }
}

export async function getSentMessages(cycleId: number) {
  const result = await sql`
    SELECT * FROM slack_messages WHERE cycle_id = ${cycleId} ORDER BY posted_at ASC
  `
  return result.rows
}
