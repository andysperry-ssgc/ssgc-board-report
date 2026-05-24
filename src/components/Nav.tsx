'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const path = usePathname()

  return (
    <nav className="bg-white border-b border-gray-200 no-print">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-gray-900 mr-4">SafeSpace Global</span>
            <Link
              href="/"
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                path === '/' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Submit update
            </Link>
            <Link
              href="/archive"
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                path === '/archive' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Archive
            </Link>
          </div>
          <Link
            href="/admin"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Admin ↗
          </Link>
        </div>
      </div>
    </nav>
  )
}
