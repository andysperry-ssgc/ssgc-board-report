/**
 * Slack message template constants and rendering helpers.
 * This file has NO server-only imports — safe to use in client components.
 * slack.ts re-exports these for server-side use.
 */

import type { SlackMessageType, SubmissionStatus } from '@/types'
import { TEAM_MEMBERS } from './team'

export const DEFAULT_TEMPLATES: Record<SlackMessageType, string> = {
  opening:
`<!channel> 📋 *Board report submissions are open — {{cycleLabel}}*

Time to submit your update. Deadline is *Wednesday at 9:00 am CT*.

👋 {{teamNames}}

Submit here: {{submissionUrl}}
_Report goes out by 5:00 pm Wednesday. Scott will distribute._`,

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
`<!channel> 🚨 *Last call — 2 hours left! {{cycleLabel}}*
Submissions close at *9:00 am CT*.

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
    pendingList:   pending.length   === 0 ? '_Everyone is in!_' : pending.map(s => `⏳ ${s.firstName}`).join('  '),
    pendingNames:  pending.map(s => s.name).join(', '),
  }
}
