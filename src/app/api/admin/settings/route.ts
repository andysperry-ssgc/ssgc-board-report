import { NextRequest, NextResponse } from 'next/server'
import { getAllSettings, setSetting, deleteSetting } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    const settings = await getAllSettings()
    return NextResponse.json({ settings })
  } catch (err) {
    console.error('GET /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
    }

    await setSetting(key, value)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    await deleteSetting(key)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 })
  }
}
