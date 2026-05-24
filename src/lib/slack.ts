import { WebClient } from '@slack/web-api'
import { sql } from '@vercel/postgres'
import type { SlackMessageType, SubmissionStatus } from '@/types'
import { TEAM_MEMBERS } from './team'

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
  return `📋 *Board report submissions are open — ${cycleLabel}*

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
  return `${emoji} *Board report reminder — ${cycleLabel}* (${messageNum} of 3)

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
  return `🔴 *Final warning — ${cycleLabel}*
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
  return `🚨 *Last call — 2 hours left! ${cycleLabel}*
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
