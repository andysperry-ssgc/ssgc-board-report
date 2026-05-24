import { NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST() {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await initDb()
    return NextResponse.json({ success: true, message: 'Database initialized' })
  } catch (err) {
    console.error('POST /api/init error:', err)
    return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 })
  }
}
