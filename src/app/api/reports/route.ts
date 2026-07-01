import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { Report } from '@/types'

export async function GET() {
  try {
    const result = await sql<Report>`
      SELECT r.*, c.label as cycle_label
      FROM reports r
      LEFT JOIN cycles c ON r.cycle_id = c.id
      ORDER BY r.generated_at DESC
    `
    return NextResponse.json({ reports: result.rows })
  } catch (err) {
    console.error('GET /api/reports error:', err)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { cycle_id, period, type, content, source } = body

    if (!period || !type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert in application code: update an existing report for this cycle if
    // present, otherwise insert. Done manually (not via ON CONFLICT) because the
    // reports table has no unique constraint on cycle_id.
    let result: { rows: Report[] }
    if (cycle_id) {
      const updated = await sql<Report>`
        UPDATE reports
          SET content = ${content},
              period = ${period},
              type = ${type},
              source = ${source ?? 'generated'},
              generated_at = NOW()
          WHERE cycle_id = ${cycle_id}
          RETURNING *
      `
      result = updated.rows.length > 0
        ? updated
        : await sql<Report>`
            INSERT INTO reports (cycle_id, period, type, content, source)
            VALUES (${cycle_id}, ${period}, ${type}, ${content}, ${source ?? 'generated'})
            RETURNING *
          `
    } else {
      result = await sql<Report>`
        INSERT INTO reports (cycle_id, period, type, content, source)
        VALUES (NULL, ${period}, ${type}, ${content}, ${source ?? 'generated'})
        RETURNING *
      `
    }
    return NextResponse.json({ report: result.rows[0] })
  } catch (err) {
    console.error('POST /api/reports error:', err)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await sql`DELETE FROM reports WHERE id = ${parseInt(id)}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/reports error:', err)
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }
}
