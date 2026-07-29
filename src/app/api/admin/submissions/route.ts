import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCycleById, upsertSubmission } from '@/lib/cycles'
import { getTeamNames } from '@/lib/team-store'

// Admin-only: create or correct a submission on behalf of any team member for a
// specific cycle. Unlike the public /api/submissions route, this targets an
// explicit cycle and is not blocked once the cycle has closed — so an admin can
// add a late input (e.g. someone who never submitted) and then regenerate.
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { cycle_id, person_name, headline, progress, risks, metrics, board_update, focus, priorities } = body

    if (!cycle_id || !person_name || !headline?.trim() || !progress?.trim() || !risks?.trim()) {
      return NextResponse.json(
        { error: 'cycle_id, person_name, headline, progress, and risks are required' },
        { status: 400 },
      )
    }

    const cycle = await getCycleById(Number(cycle_id))
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 400 })
    }

    const teamNames = await getTeamNames()
    if (!teamNames.includes(person_name)) {
      return NextResponse.json({ error: 'Not a current team member' }, { status: 400 })
    }

    const submission = await upsertSubmission(cycle.id, person_name, {
      headline: headline.trim(),
      progress: progress.trim(),
      risks: risks.trim(),
      metrics: metrics?.trim() || undefined,
      board_update: board_update?.trim() || undefined,
      focus: focus?.trim() || undefined,
      priorities: priorities?.trim() || undefined,
    })

    return NextResponse.json({ submission })
  } catch (err) {
    console.error('POST /api/admin/submissions error:', err)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }
}
