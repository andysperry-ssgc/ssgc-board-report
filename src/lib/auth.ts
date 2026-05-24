import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { AdminSession } from '@/types'

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'fallback_dev_secret_change_in_production_32chars',
  cookieName: 'safespace_admin',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}

export async function getSession() {
  const session = await getIronSession<AdminSession>(await cookies(), sessionOptions)
  return session
}

export async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  return session.isAdmin === true
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? 'admin123'
}

export async function withAdminAuth(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getIronSession<AdminSession>(req.cookies as never, sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handler(req)
}
