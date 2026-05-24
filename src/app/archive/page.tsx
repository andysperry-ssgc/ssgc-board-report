'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import type { Report } from '@/types'

export default function ArchivePage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false))
  }, [])

  function handlePrint(report: Report) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.period} — SafeSpace Global Board Report</title>
          <style>
            body { font-family: Georgia, serif; max-width: 750px; margin: 40px auto; color: #111; line-height: 1.6; font-size: 11pt; }
            h1 { font-size: 16pt; margin-bottom: 4pt; }
            h2 { font-size: 12pt; margin-top: 24pt; margin-bottom: 6pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }
            .meta { color: #555; font-size: 9pt; margin-bottom: 24pt; }
            ul { padding-left: 20pt; }
            li { margin-bottom: 4pt; }
            p { margin-bottom: 10pt; }
            .confidential { font-size: 8pt; color: #888; font-style: italic; margin-bottom: 16pt; }
          </style>
        </head>
        <body>
          <pre style="white-space:pre-wrap;font-family:Georgia,serif">${escapeHtml(report.content)}</pre>
        </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  function escapeHtml(str: string) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Report archive</h1>

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="card p-8 text-center text-sm text-gray-500">
            No reports yet.
          </div>
        )}

        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{report.period}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {report.type === 'biweekly' ? 'Biweekly' : 'Weekly'} ·{' '}
                    {report.source === 'uploaded' ? 'Uploaded' : 'Generated'} ·{' '}
                    {new Date(report.generated_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(report)}
                    className="btn-ghost text-xs"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                    className="btn-ghost text-xs"
                  >
                    {expanded === report.id ? 'Collapse' : 'Preview'}
                  </button>
                </div>
              </div>

              {expanded === report.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                    {report.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
