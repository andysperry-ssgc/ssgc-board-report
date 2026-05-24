import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, getAdminPassword } from '@/lib/auth'
import type { AdminSession } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ error: 'Missing password' }, { status: 400 })
    }

    if (password !== getAdminPassword()) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const session = await getIronSession<AdminSession>(await cookies(), sessionOptions)
    session.isAdmin = true
    await session.save()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/admin/auth error:', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getIronSession<AdminSession>(await cookies(), sessionOptions)
    session.destroy()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/auth error:', err)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getIronSession<AdminSession>(await cookies(), sessionOptions)
    return NextResponse.json({ isAdmin: session.isAdmin === true })
  } catch {
    return NextResponse.json({ isAdmin: false })
  }
}
