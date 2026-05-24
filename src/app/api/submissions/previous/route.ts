import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getCurrentCycle, getPreviousSubmission } from '@/lib/cycles'
import { getTeamNames } from '@/lib/team'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const personName = searchParams.get('person')

    if (!personName) {
      return NextResponse.json({ error: 'Missing person parameter' }, { status: 400 })
    }

    const teamNames = getTeamNames()
    if (!teamNames.includes(personName)) {
      return NextResponse.json({ error: 'Invalid team member' }, { status: 400 })
    }

    const cycle = await getCurrentCycle()
    if (!cycle) {
      return NextResponse.json({ previous: null })
    }

    const previous = await getPreviousSubmission(personName, cycle.id)
    return NextResponse.json({ previous })
  } catch (err) {
    console.error('GET /api/submissions/previous error:', err)
    return NextResponse.json({ error: 'Failed to load previous submission' }, { status: 500 })
  }
}
