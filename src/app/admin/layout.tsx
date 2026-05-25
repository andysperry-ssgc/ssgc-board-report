'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/archive', label: 'Archive' },
  { href: '/admin/reminders', label: 'Reminders' },
  { href: '/admin/settings', label: 'Settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const router = useRouter()
  const path = usePathname()

  useEffect(() => {
    fetch('/api/admin/auth')
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data.isAdmin)
        if (!data.isAdmin && path !== '/admin/login') {
          router.push('/admin/login')
        }
      })
      .catch(() => {
        setIsAdmin(false)
        router.push('/admin/login')
      })
  }, [path, router])

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  if (path === '/admin/login') return <>{children}</>
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    )
  }
  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-gray-900 mr-3">Admin</span>
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    path === tab.href
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Site</Link>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
