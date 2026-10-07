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
  if (session.isAdmin !== true) return false
  await renewSession(session)
  return true
}

/**
 * Re-issue the session cookie so its 14-day lifetime restarts from now. Sessions
 * otherwise expire 14 days after login regardless of use — which lands right on
 * the biweekly report cycle. Only works where cookies are writable (API routes).
 */
export async function renewSession(session: Awaited<ReturnType<typeof getSession>>): Promise<void> {
  try {
    await session.save()
  } catch {
    // Renewal is best-effort; never fail the request over it.
  }
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
