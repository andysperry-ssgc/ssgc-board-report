import { WebClient } from '@slack/web-api'
import { sql } from '@/lib/db'
import type { SlackMessageType, SubmissionStatus } from '@/types'
import { TEAM_MEMBERS } from './team'

// Re-export template helpers from the browser-safe module
export { DEFAULT_TEMPLATES, renderTemplate, getTemplateVars } from './slack-templates'
import { DEFAULT_TEMPLATES, renderTemplate, getTemplateVars } from './slack-templates'

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

export function buildOpeningMessage(cycleLabel: string, submissionUrl: string): string {
  const vars = {
    cycleLabel,
    submissionUrl,
    teamNames: TEAM_MEMBERS.map(m => m.firstName).join(' '),
    submittedList: '',
    pendingList: '',
    pendingNames: '',
  }
  return renderTemplate(DEFAULT_TEMPLATES.opening, vars)
}

export function buildReminderMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[],
  messageNum: 1 | 2 | 3
): string {
  const vars = getTemplateVars(cycleLabel, submissionUrl, statuses)
  const templateKey = `reminder_${messageNum}` as SlackMessageType
  return renderTemplate(DEFAULT_TEMPLATES[templateKey], vars)
}

export function buildFinalWarningMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[]
): string {
  const vars = getTemplateVars(cycleLabel, submissionUrl, statuses)
  return renderTemplate(DEFAULT_TEMPLATES.final_warning, vars)
}

export function buildLastCallMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[]
): string {
  const vars = getTemplateVars(cycleLabel, submissionUrl, statuses)
  return renderTemplate(DEFAULT_TEMPLATES.last_call, vars)
}

export function buildCelebrationMessage(statuses: SubmissionStatus[]): string {
  const allNames = statuses.map((s) => `✅ ${s.firstName}`).join('  ')
  return `🎉 *All board report submissions are in!*

${allNames}

Thank you all — great work! Report will be distributed by 5:00 pm Wednesday. Scott will distribute.`
}

export function buildClosedMessage(
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[]
): string {
  const vars = getTemplateVars(cycleLabel, submissionUrl, statuses)
  return renderTemplate(DEFAULT_TEMPLATES.closed, vars)
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
