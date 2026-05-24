import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCycle, getSubmissionsForCycle, upsertSubmission, getSubmissionStatus } from '@/lib/cycles'
import { getTeamNames } from '@/lib/team'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const cycleIdParam = searchParams.get('cycle_id')

    let cycle = null
    if (cycleIdParam) {
      const { getCycleById } = await import('@/lib/cycles')
      cycle = await getCycleById(parseInt(cycleIdParam))
    } else {
      cycle = await getCurrentCycle()
    }

    if (!cycle) {
      return NextResponse.json({ cycle: null, submissions: [], statuses: [] })
    }
    const submissions = await getSubmissionsForCycle(cycle.id)
    const statuses = await getSubmissionStatus(cycle.id)
    return NextResponse.json({ cycle, submissions, statuses })
  } catch (err) {
    console.error('GET /api/submissions error:', err)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { person_name, headline, progress, risks, metrics, board_update, focus, priorities } = body

    if (!person_name || !headline || !progress || !risks) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const teamNames = getTeamNames()
    if (!teamNames.includes(person_name)) {
      return NextResponse.json({ error: 'Invalid team member name' }, { status: 400 })
    }

    const cycle = await getCurrentCycle()
    if (!cycle) {
      return NextResponse.json({ error: 'No active cycle. Ask an admin to open a new cycle.' }, { status: 400 })
    }

    const now = new Date()
    if (now > new Date(cycle.closes_at)) {
      return NextResponse.json({ error: 'Submissions are closed for this cycle.' }, { status: 400 })
    }

    const submission = await upsertSubmission(cycle.id, person_name, {
      headline,
      progress,
      risks,
      metrics: metrics || undefined,
      board_update: board_update || undefined,
      focus: focus || undefined,
      priorities: priorities || undefined,
    })

    return NextResponse.json({ submission })
  } catch (err) {
    console.error('POST /api/submissions error:', err)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }
}
