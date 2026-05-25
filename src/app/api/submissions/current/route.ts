import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCycle, getSubmissionByPerson } from '@/lib/cycles'
import { getTeamNames } from '@/lib/team'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ submission: null })
    }

    const submission = await getSubmissionByPerson(cycle.id, personName)
    return NextResponse.json({ submission })
  } catch (err) {
    console.error('GET /api/submissions/current error:', err)
    return NextResponse.json({ error: 'Failed to load submission' }, { status: 500 })
  }
}
