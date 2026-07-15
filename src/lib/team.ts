import type { TeamMember } from '@/types'

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Anand Ijju', firstName: 'Anand' },
  { name: 'Andy Sperry', firstName: 'Andy' },
  { name: 'Caleb Dixon', firstName: 'Caleb' },
  { name: 'Carmel Fisher', firstName: 'Carmel' },
  { name: 'Dustin Hillis', firstName: 'Dustin' },
  { name: 'Katie Piperata', firstName: 'Katie' },
  { name: 'Kelly Brown', firstName: 'Kelly' },
  { name: 'Michael Hrynuik', firstName: 'Michael' },
  { name: 'Nainika Sharma', firstName: 'Nainika' },
  { name: 'Nicole Beal', firstName: 'Nicole' },
  { name: 'Paul Boyd', firstName: 'Paul' },
  { name: 'Pete Coulter', firstName: 'Pete' },
  { name: 'Scott M Boruff', firstName: 'Scott' },
  { name: 'Shaun Kancherla', firstName: 'Shaun' },
]

export function getTeamMember(name: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.name === name)
}

export function getTeamNames(): string[] {
  return TEAM_MEMBERS.map((m) => m.name)
}

export function parseTeamList(raw: string): TeamMember[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      firstName: name.split(' ')[0],
    }))
}

/** Serialize a roster back to the newline-delimited form stored in settings. */
export function serializeTeamList(members: { name: string }[]): string {
  return members
    .map((m) => m.name.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Merge a base roster with anyone who appears in `submissions` but isn't on it.
 * Keeps historical submitters (e.g. someone since removed from the team) visible
 * in past-cycle views while still showing current members who haven't submitted.
 */
export function mergeRoster(
  base: TeamMember[],
  submissions: { person_name: string }[],
): TeamMember[] {
  const known = new Set(base.map((m) => m.name))
  const extra: TeamMember[] = []
  for (const s of submissions) {
    if (!known.has(s.person_name)) {
      known.add(s.person_name)
      extra.push({ name: s.person_name, firstName: s.person_name.split(' ')[0] })
    }
  }
  return [...base, ...extra]
}
