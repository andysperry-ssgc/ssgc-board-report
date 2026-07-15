import { getSetting } from './db'
import { TEAM_MEMBERS, parseTeamList } from './team'
import type { TeamMember } from '@/types'

/**
 * The effective team roster. Reads the `team_members` setting (one full name per
 * line, editable in admin Settings) and falls back to the built-in default list
 * when the setting is unset or empty. Server-only (touches the database).
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const raw = await getSetting('team_members')
  if (!raw || !raw.trim()) return TEAM_MEMBERS
  const parsed = parseTeamList(raw)
  return parsed.length > 0 ? parsed : TEAM_MEMBERS
}

/** Effective team member full names. */
export async function getTeamNames(): Promise<string[]> {
  return (await getTeamMembers()).map((m) => m.name)
}
