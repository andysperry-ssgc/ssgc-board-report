'use client'

import { useState, useEffect } from 'react'
import type { Report } from '@/types'

export default function AdminArchivePage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ period: '', type: 'biweekly' as 'weekly' | 'biweekly', content: '' })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      const data = await res.json()
      setReports(data.reports ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeleting(id)
    try {
      await fetch(`/api/reports?id=${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setDeleting(null)
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setUploading(true)
    setError('')
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...uploadForm, source: 'uploaded' }),
      })
      if (!res.ok) throw new Error('Upload failed')
      setShowUpload(false)
      setUploadForm({ period: '', type: 'biweekly', content: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handlePrint(report: Report) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.period} — SafeSpace Global</title>
          <style>
            body { font-family: Georgia, serif; max-width: 750px; margin: 40px auto; color: #111; line-height: 1.65; font-size: 11pt; }
            pre { white-space: pre-wrap; font-family: Georgia, serif; }
          </style>
        </head>
        <body><pre>${report.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body>
      </html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Archive</h1>
        <button onClick={() => setShowUpload(true)} className="btn-secondary text-sm">
          Upload past report
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="card w-full max-w-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Upload past report</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="label">Period label</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Apr 28 – May 9"
                  value={uploadForm.period}
                  onChange={(e) => setUploadForm({ ...uploadForm, period: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value as 'weekly' | 'biweekly' })}
                >
                  <option value="biweekly">Biweekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="label">Report content</label>
                <textarea
                  className="textarea min-h-[200px] font-mono text-xs"
                  placeholder="Paste report text here…"
                  value={uploadForm.content}
                  onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={uploading} className="btn-primary">
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          No reports yet. Generate one or upload a past report.
        </div>
      ) : (
        <div className="space-y-2">
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
                  <button
                    onClick={() => handleDelete(report.id)}
                    disabled={deleting === report.id}
                    className="btn-ghost text-xs text-red-500 hover:text-red-700"
                  >
                    {deleting === report.id ? '…' : 'Delete'}
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
      )}
    </div>
  )
}
