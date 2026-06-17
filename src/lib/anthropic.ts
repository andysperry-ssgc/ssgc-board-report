import Anthropic from '@anthropic-ai/sdk'
import type { Submission } from '@/types'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4000

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export async function draftSubmission(
  personName: string,
  period: string,
  notes: string
): Promise<Record<string, string>> {
  const prompt = `You are helping ${personName} draft their board report submission for SafeSpace Global. The reporting period is ${period}.

They have provided the following raw notes, activity summary, or meeting records:
---
${notes}
---

Extract and draft content for each field below. Be concise and executive — this goes into a board report. Write in first person. Only include a field if there is genuinely relevant content; leave it blank otherwise.

Return ONLY a JSON object with exactly these keys (empty string "" if nothing relevant):
{
  "headline": "One sentence — single most important outcome",
  "progress": "Meaningful progress and wins — what got done",
  "risks": "Blockers, issues, concerns. Root cause if apparent. If nothing, write None.",
  "metrics": "Any specific numbers or measurable results mentioned",
  "board": "Anything relevant for the Board — governance, capital, strategic, investor-facing",
  "focus": "What they were primarily working on — 3 bullets max",
  "priorities": "What they plan to focus on next period"
}

Return only the JSON. No preamble, no explanation, no markdown fences.`

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}

function formatSubmissionForReport(sub: Submission): string {
  const lines = [`=== ${sub.person_name} ===`]
  lines.push(`HEADLINE: ${sub.headline}`)
  lines.push(`PROGRESS / WINS: ${sub.progress}`)
  lines.push(`RISKS / ISSUES: ${sub.risks}`)
  if (sub.metrics) lines.push(`KEY METRICS: ${sub.metrics}`)
  if (sub.board_update) lines.push(`BOARD-RELEVANT UPDATE: ${sub.board_update}`)
  if (sub.focus) lines.push(`FOCUS LAST PERIOD: ${sub.focus}`)
  if (sub.priorities) lines.push(`NEXT PERIOD PRIORITIES: ${sub.priorities}`)
  lines.push('---')
  return lines.join('\n')
}

export async function generateReport(
  period: string,
  type: 'weekly' | 'biweekly',
  submissions: Submission[]
): Promise<string> {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const inputsBlock = submissions.map(formatSubmissionForReport).join('\n')

  const prompt = `You are preparing a Business Summary for SafeSpace Global for Executive Leadership and the Board of Directors. Synthesize all inputs into a single coherent executive narrative — not a department-by-department recap.

REPORT HEADER:
SafeSpace Global – ${type === 'biweekly' ? 'Biweekly' : 'Weekly'} Business Summary
Reporting Period: ${period}
Report Generated: ${today}

INPUTS FROM LEADERSHIP TEAM:
${inputsBlock}

Return exactly this structure:

SafeSpace Global – ${type === 'biweekly' ? 'Biweekly' : 'Weekly'} Business Summary
Reporting Period: ${period}
Report Generated: ${today}

Confidential – Internal Use Only. This report may contain material nonpublic information. Do not distribute or trade on this information.

Executive Summary
[4–6 bullets. Lead with commercial developments. Include company stage, deployment reality, primary constraint to scaling, major governance milestones.]

Business Overview
[4–7 paragraphs. CEO/COO narrative. Order: commercial momentum → pipeline/market → deployment reality → product/engineering/compliance → installation/support → marketing/IR → corporate readiness and inflection point.]

Key Takeaways
[3–5 bullets. Core truths this period. Not a repeat of Executive Summary.]

Metrics Snapshot
[Bullets under: Sales & Pipeline / Deployments & Product Performance / Marketing & External / Operations & System Health]

Risks / Watch Items
[3–6 bullets. Most important risks.]

Near-Term Priorities
[4–6 outcome-focused bullets.]

Rules: Do not organize by department. Write as one company. Lead with commercial significance. Executive, direct, grounded — no hype, no spin.`

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
