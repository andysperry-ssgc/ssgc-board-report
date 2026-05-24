import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { generateReport } from '@/lib/anthropic'
import { getSubmissionsForCycle } from '@/lib/cycles'
import { requireAdmin } from '@/lib/auth'
import type { Submission } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { period, type, cycle_id } = body

    if (!period || !type) {
      return NextResponse.json({ error: 'Missing period or type' }, { status: 400 })
    }

    let submissions: Submission[] = []
    if (cycle_id) {
      submissions = await getSubmissionsForCycle(cycle_id)
    } else {
      const cycleResult = await sql`SELECT * FROM cycles WHERE is_current = true LIMIT 1`
      if (cycleResult.rows[0]) {
        submissions = await getSubmissionsForCycle(cycleResult.rows[0].id)
      }
    }

    if (submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found for this cycle' }, { status: 400 })
    }

    const content = await generateReport(period, type as 'weekly' | 'biweekly', submissions)
    return NextResponse.json({ content })
  } catch (err) {
    console.error('POST /api/generate error:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
