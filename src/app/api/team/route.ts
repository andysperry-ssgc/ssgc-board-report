import { NextResponse } from 'next/server'
import { getTeamMembers } from '@/lib/team-store'

export const dynamic = 'force-dynamic'

// Effective team roster (custom list from settings, or the built-in default).
export async function GET() {
  try {
    const members = await getTeamMembers()
    return NextResponse.json({ members })
  } catch (err) {
    console.error('GET /api/team error:', err)
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 })
  }
}
