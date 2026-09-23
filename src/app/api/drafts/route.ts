import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Unsaved report drafts, one per cycle, stored server-side in the settings table
// (key `report_draft_<cycleId>`) so a draft survives reloads, other devices and
// cleared browsers. Admin-only: drafts are confidential board content.
const PREFIX = 'report_draft_'
const keyFor = (cycleId: number) => `${PREFIX}${cycleId}`

function parseCycleId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// GET ?cycle_id=N → { draft: { content, updated_at } | null }
// GET (no params) → { drafts: [{ cycle_id, updated_at }] }
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const raw = new URL(req.url).searchParams.get('cycle_id')

    if (raw === null) {
      const result = await sql<{ key: string; updated_at: string }>`
        SELECT key, updated_at FROM settings WHERE starts_with(key, ${PREFIX})
      `
      const drafts = result.rows.map((r) => ({
        cycle_id: Number(r.key.slice(PREFIX.length)),
        updated_at: r.updated_at,
      }))
      return NextResponse.json({ drafts })
    }

    const cycleId = parseCycleId(raw)
    if (cycleId === null) {
      return NextResponse.json({ error: 'Invalid cycle_id' }, { status: 400 })
    }
    const result = await sql<{ value: string; updated_at: string }>`
      SELECT value, updated_at FROM settings WHERE key = ${keyFor(cycleId)}
    `
    const row = result.rows[0]
    return NextResponse.json({ draft: row ? { content: row.value, updated_at: row.updated_at } : null })
  } catch (err) {
    console.error('GET /api/drafts error:', err)
    return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 })
  }
}

// PUT { cycle_id, content } → { updated_at }
export async function PUT(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { cycle_id, content } = await req.json()
    const cycleId = parseCycleId(cycle_id)
    if (cycleId === null || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'cycle_id and non-empty content are required' }, { status: 400 })
    }
    const result = await sql<{ updated_at: string }>`
      INSERT INTO settings (key, value, updated_at) VALUES (${keyFor(cycleId)}, ${content}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING updated_at
    `
    return NextResponse.json({ updated_at: result.rows[0]?.updated_at })
  } catch (err) {
    console.error('PUT /api/drafts error:', err)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }
}

// DELETE ?cycle_id=N
export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const cycleId = parseCycleId(new URL(req.url).searchParams.get('cycle_id'))
    if (cycleId === null) {
      return NextResponse.json({ error: 'Invalid cycle_id' }, { status: 400 })
    }
    await sql`DELETE FROM settings WHERE key = ${keyFor(cycleId)}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/drafts error:', err)
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }
}
