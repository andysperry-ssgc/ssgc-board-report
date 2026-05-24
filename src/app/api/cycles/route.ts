import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getCurrentCycle, getAllCycles, createCycle, closeCycle } from '@/lib/cycles'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    const cycles = await getAllCycles()
    return NextResponse.json({ cycles })
  } catch (err) {
    console.error('GET /api/cycles error:', err)
    return NextResponse.json({ error: 'Failed to load cycles' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { label, type, opens_at, closes_at } = body

    if (!label || !type || !opens_at || !closes_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cycle = await createCycle(
      label,
      type as 'weekly' | 'biweekly',
      new Date(opens_at),
      new Date(closes_at)
    )

    return NextResponse.json({ cycle })
  } catch (err) {
    console.error('POST /api/cycles error:', err)
    return NextResponse.json({ error: 'Failed to create cycle' }, { status: 500 })
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

    await closeCycle(parseInt(id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/cycles error:', err)
    return NextResponse.json({ error: 'Failed to close cycle' }, { status: 500 })
  }
}
