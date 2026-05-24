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
