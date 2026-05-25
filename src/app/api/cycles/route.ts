import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getCurrentCycle, getAllCycles, createCycle, closeCycle } from '@/lib/cycles'
import { requireAdmin } from '@/lib/auth'

// Returns "-05:00" (CDT) or "-06:00" (CST) based on whether the date is in daylight saving time
function getCTOffset(dateStr: string): string {
  const date = new Date(dateStr)
  // CDT runs second Sunday in March → first Sunday in November
  const year = date.getFullYear()
  const dstStart = getNthSunday(year, 2, 2) // March, 2nd Sunday
  const dstEnd = getNthSunday(year, 10, 1)  // November, 1st Sunday
  const isDST = date >= dstStart && date < dstEnd
  return isDST ? '-05:00' : '-06:00'
}

function getNthSunday(year: number, month: number, n: number): Date {
  const d = new Date(year, month - 1, 1)
  const dayOfWeek = d.getDay()
  const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return new Date(year, month - 1, firstSunday + (n - 1) * 7, 2, 0, 0)
}

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

    // datetime-local sends "YYYY-MM-DDTHH:mm" with no timezone — treat as CT (UTC-5 CDT / UTC-6 CST)
    // We append the CT offset so Date parses correctly
    const ctOffset = getCTOffset(opens_at)
    const cycle = await createCycle(
      label,
      type as 'weekly' | 'biweekly',
      new Date(opens_at + ctOffset),
      new Date(closes_at + getCTOffset(closes_at))
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
