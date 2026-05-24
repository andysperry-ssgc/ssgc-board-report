import { sql } from '@/lib/db'
import type { Cycle, Submission, SubmissionStatus } from '@/types'
import { TEAM_MEMBERS } from './team'

export async function getCurrentCycle(): Promise<Cycle | null> {
  const result = await sql<Cycle>`
    SELECT * FROM cycles WHERE is_current = true ORDER BY created_at DESC LIMIT 1
  `
  return result.rows[0] ?? null
}

export async function getCycleById(id: number): Promise<Cycle | null> {
  const result = await sql<Cycle>`SELECT * FROM cycles WHERE id = ${id}`
  return result.rows[0] ?? null
}

export async function getAllCycles(): Promise<Cycle[]> {
  const result = await sql<Cycle>`SELECT * FROM cycles ORDER BY created_at DESC`
  return result.rows
}

export async function createCycle(
  label: string,
  type: 'weekly' | 'biweekly',
  opensAt: Date,
  closesAt: Date
): Promise<Cycle> {
  // Unset current
  await sql`UPDATE cycles SET is_current = false WHERE is_current = true`

  const result = await sql<Cycle>`
    INSERT INTO cycles (label, type, opens_at, closes_at, is_current)
    VALUES (${label}, ${type}, ${opensAt.toISOString()}, ${closesAt.toISOString()}, true)
    RETURNING *
  `
  return result.rows[0]
}

export async function closeCycle(cycleId: number): Promise<void> {
  await sql`UPDATE cycles SET is_current = false WHERE id = ${cycleId}`
}

export async function getSubmissionsForCycle(cycleId: number): Promise<Submission[]> {
  const result = await sql<Submission>`
    SELECT * FROM submissions WHERE cycle_id = ${cycleId} ORDER BY submitted_at ASC
  `
  return result.rows
}

export async function getSubmissionByPerson(
  cycleId: number,
  personName: string
): Promise<Submission | null> {
  const result = await sql<Submission>`
    SELECT * FROM submissions WHERE cycle_id = ${cycleId} AND person_name = ${personName}
  `
  return result.rows[0] ?? null
}

export async function getPreviousSubmission(personName: string, currentCycleId: number): Promise<Submission | null> {
  const result = await sql<Submission>`
    SELECT s.* FROM submissions s
    JOIN cycles c ON s.cycle_id = c.id
    WHERE s.person_name = ${personName}
      AND s.cycle_id != ${currentCycleId}
    ORDER BY s.submitted_at DESC
    LIMIT 1
  `
  return result.rows[0] ?? null
}

export async function upsertSubmission(
  cycleId: number,
  personName: string,
  data: {
    headline: string
    progress: string
    risks: string
    metrics?: string
    board_update?: string
    focus?: string
    priorities?: string
  }
): Promise<Submission> {
  const result = await sql<Submission>`
    INSERT INTO submissions (cycle_id, person_name, headline, progress, risks, metrics, board_update, focus, priorities, submitted_at, updated_at)
    VALUES (
      ${cycleId}, ${personName},
      ${data.headline}, ${data.progress}, ${data.risks},
      ${data.metrics ?? null}, ${data.board_update ?? null},
      ${data.focus ?? null}, ${data.priorities ?? null},
      NOW(), NOW()
    )
    ON CONFLICT (cycle_id, person_name) DO UPDATE SET
      headline = EXCLUDED.headline,
      progress = EXCLUDED.progress,
      risks = EXCLUDED.risks,
      metrics = EXCLUDED.metrics,
      board_update = EXCLUDED.board_update,
      focus = EXCLUDED.focus,
      priorities = EXCLUDED.priorities,
      updated_at = NOW()
    RETURNING *
  `
  return result.rows[0]
}

export async function getSubmissionStatus(cycleId: number): Promise<SubmissionStatus[]> {
  const submissions = await getSubmissionsForCycle(cycleId)
  const submittedNames = new Set(submissions.map((s) => s.person_name))

  return TEAM_MEMBERS.map((member) => {
    const sub = submissions.find((s) => s.person_name === member.name)
    return {
      name: member.name,
      firstName: member.firstName,
      submitted: submittedNames.has(member.name),
      submitted_at: sub?.submitted_at,
    }
  })
}

export async function getPendingNames(cycleId: number): Promise<string[]> {
  const statuses = await getSubmissionStatus(cycleId)
  return statuses.filter((s) => !s.submitted).map((s) => s.name)
}

export async function getSubmittedNames(cycleId: number): Promise<string[]> {
  const statuses = await getSubmissionStatus(cycleId)
  return statuses.filter((s) => s.submitted).map((s) => s.name)
}

export function allSubmitted(statuses: SubmissionStatus[]): boolean {
  return statuses.every((s) => s.submitted)
}
