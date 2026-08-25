/**
 * Slack message template constants and rendering helpers.
 * This file has NO server-only imports — safe to use in client components.
 * slack.ts re-exports these for server-side use.
 */

import type { SlackMessageType, SubmissionStatus } from '@/types'

export const DEFAULT_TEMPLATES: Record<SlackMessageType, string> = {
  opening:
`<!channel> 📋 *Board report submissions are open — {{cycleLabel}}*

Time to submit your update. Deadline is *Wednesday at 9:00 am CT*.

👋 {{teamNames}}

Submit here: {{submissionUrl}}
_Report goes out by 5:00 pm Wednesday. Carmel will distribute._`,

  reminder_1:
`<!channel> ⏰ *Board report reminder — {{cycleLabel}}* (1 of 3)

{{submittedList}}
{{pendingList}}

Deadline: *Wednesday 9:00 am CT* | Submit: {{submissionUrl}}`,

  reminder_2:
`<!channel> 🔔 *Board report reminder — {{cycleLabel}}* (2 of 3)

{{submittedList}}
{{pendingList}}

Deadline: *Wednesday 9:00 am CT* | Submit: {{submissionUrl}}`,

  reminder_3:
`<!channel> 📣 *Board report reminder — {{cycleLabel}}* (3 of 3)

{{submittedList}}
{{pendingList}}

Deadline: *Wednesday 9:00 am CT* | Submit: {{submissionUrl}}`,

  final_warning:
`<!channel> 🔴 *Final warning — {{cycleLabel}}*
Submissions close at *9:00 am CT today* (2 hours).

{{submittedList}}
⏳ *Still needed:* {{pendingNames}}

Submit now: {{submissionUrl}}`,

  last_call:
`<!channel> 🚨 *Last call — 1 hour left! {{cycleLabel}}*
Submissions close at *9:00 am CT*.

{{submittedList}}
{{pendingList}}

Submit: {{submissionUrl}}`,

  celebration:
`🎉 *All board report submissions are in!*

{{submittedList}}

Thank you all — great work! Report will be distributed by 5:00 pm Wednesday. Carmel will distribute.`,

  closed:
`📊 *{{cycleLabel}} submissions are now closed.*

Reporting period ended at 9:00 am CT.

{{submittedList}}

Thank you all for your contributions!

{{pendingNames}} — we didn't receive your update this cycle.

Andy is compiling the report and will share it with Dustin, Scott, and Carmel for final review and approval. Carmel will distribute the board report by 5:00 pm CT today.`,
}

/** Settings key under which a custom template override for a message type is stored. */
export const templateKey = (type: SlackMessageType) => `slack_msg_${type}`

/** Resolve the template for a message type — custom override (from settings) or default. */
export function resolveTemplate(type: SlackMessageType, settings: Record<string, string>): string {
  return settings[templateKey(type)] ?? DEFAULT_TEMPLATES[type]
}

/** Replace {{variable}} placeholders in a template string. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  )
}

/**
 * Resolve + render a message in one step. Single source of truth used by both
 * the cron (automated sends) and the manual send / preview routes, so custom
 * template overrides always take effect everywhere.
 */
export function renderMessage(
  type: SlackMessageType,
  settings: Record<string, string>,
  cycleLabel: string,
  submissionUrl: string,
  statuses: SubmissionStatus[],
): string {
  const vars = getTemplateVars(cycleLabel, submissionUrl, statuses)
  return renderTemplate(resolveTemplate(type, settings), vars)
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
    teamNames:     statuses.map(s => s.displayName).join(' '),
    submittedList: submitted.length === 0 ? '_None yet_' : submitted.map(s => `✅ ${s.displayName}`).join('  '),
    pendingList:   pending.length   === 0 ? '_Everyone is in!_' : pending.map(s => `⏳ ${s.displayName}`).join('  '),
    pendingNames:  pending.map(s => s.name).join(', '),
  }
}
