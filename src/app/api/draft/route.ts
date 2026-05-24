import { NextRequest, NextResponse } from 'next/server'
import { draftSubmission } from '@/lib/anthropic'
import { getCurrentCycle } from '@/lib/cycles'
import { getTeamNames } from '@/lib/team'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { person_name, notes } = body

    if (!person_name || !notes?.trim()) {
      return NextResponse.json({ error: 'Missing person_name or notes' }, { status: 400 })
    }

    const teamNames = getTeamNames()
    if (!teamNames.includes(person_name)) {
      return NextResponse.json({ error: 'Invalid team member' }, { status: 400 })
    }

    const cycle = await getCurrentCycle()
    const period = cycle?.label ?? 'current period'

    const draft = await draftSubmission(person_name, period, notes)
    return NextResponse.json({ draft })
  } catch (err) {
    console.error('POST /api/draft error:', err)
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
  }
}
