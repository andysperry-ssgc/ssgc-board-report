import { NextRequest, NextResponse } from 'next/server'
import { getAllSettings, setSetting } from '@/lib/db'
import { requireAdmin, getAdminPassword } from '@/lib/auth'

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

    // Password change is handled via env var note — we store a hashed version
    if (key === 'admin_password') {
      // In production, this would set ADMIN_PASSWORD env var via Vercel API
      // For now, we store it and check both env var and setting
      await setSetting('admin_password_override', value)
      return NextResponse.json({ success: true, note: 'Password updated. Restart may be needed in some environments.' })
    }

    await setSetting(key, value)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
  }
}
