'use client'

import { useState, useEffect } from 'react'
import type { Cycle, Report, Submission } from '@/types'
import { TEAM_MEMBERS } from '@/lib/team'
import { buildPrintHtml, fetchLogoBase64 } from '@/lib/report-html'

interface CycleWithReport extends Cycle {
  report?: Report
}

export default function AdminArchivePage() {
  const [cycles, setCycles] = useState<CycleWithReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null)
  const [cycleSubmissions, setCycleSubmissions] = useState<Record<number, Submission[]>>({})
  const [loadingSubmissions, setLoadingSubmissions] = useState<number | null>(null)
  const [deletingReport, setDeletingReport] = useState<number | null>(null)

  // Upload past report modal
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ period: '', type: 'biweekly' as 'weekly' | 'biweekly', content: '' })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Standalone uploaded reports (no cycle_id)
  const [standaloneReports, setStandaloneReports] = useState<Report[]>([])
  const [expandedReport, setExpandedReport] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [cycleRes, reportRes] = await Promise.all([
        fetch('/api/cycles'),
        fetch('/api/reports'),
      ])
      const cycleData = await cycleRes.json()
      const reportData = await reportRes.json()

      const allCycles: Cycle[] = cycleData.cycles ?? []
      const allReports: Report[] = reportData.reports ?? []

      // Attach reports to cycles
      const cyclesWithReports: CycleWithReport[] = allCycles.map((c) => ({
        ...c,
        report: allReports.find((r) => r.cycle_id === c.id),
      }))

      // Past cycles only (current cycle is handled by Dashboard)
      setCycles(cyclesWithReports.filter((c) => !c.is_current))

      // Reports with no cycle (manually uploaded historical reports)
      setStandaloneReports(allReports.filter((r) => r.cycle_id === null))
    } finally {
      setLoading(false)
    }
  }

  async function toggleCycle(cycleId: number) {
    if (expandedCycle === cycleId) {
      setExpandedCycle(null)
      return
    }
    setExpandedCycle(cycleId)
    if (!cycleSubmissions[cycleId]) {
      setLoadingSubmissions(cycleId)
      try {
        const res = await fetch(`/api/submissions?cycle_id=${cycleId}`)
        const data = await res.json()
        setCycleSubmissions((prev) => ({ ...prev, [cycleId]: data.submissions ?? [] }))
      } finally {
        setLoadingSubmissions(null)
      }
    }
  }

  async function handleDeleteReport(reportId: number) {
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeletingReport(reportId)
    try {
      await fetch(`/api/reports?id=${reportId}`, { method: 'DELETE' })
      await load()
    } finally {
      setDeletingReport(null)
    }
  }

  async function handlePrint(report: Report) {
    const logo = await fetchLogoBase64()
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildPrintHtml(report.period, report.content, logo))
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setUploading(true)
    setUploadError('')
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
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Archive</h1>
          <p className="text-xs text-gray-500 mt-0.5">Past cycles with their submissions and generated reports</p>
        </div>
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
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
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
      ) : (
        <div className="space-y-8">
          {/* Past cycles */}
          <section>
            {cycles.length === 0 ? (
              <div className="card p-8 text-center text-sm text-gray-500">
                No past cycles yet. Past cycles appear here after a new cycle is created.
              </div>
            ) : (
              <div className="space-y-3">
                {cycles.map((c) => {
                  const isOpen = expandedCycle === c.id
                  const subs = cycleSubmissions[c.id] ?? []

                  return (
                    <div key={c.id} className="card overflow-hidden">
                      {/* Cycle header */}
                      <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <button
                          onClick={() => toggleCycle(c.id)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <svg
                            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{c.label}</p>
                            <p className="text-xs text-gray-400">
                              Closed {new Date(c.closes_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </p>
                          </div>
                        </button>

                        {/* Report status + actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {c.report ? (
                            <>
                              <span className="text-xs text-green-600 font-medium hidden sm:inline">
                                ✓ Report saved
                              </span>
                              <button
                                onClick={() => c.report && handlePrint(c.report)}
                                className="btn-secondary text-xs"
                              >
                                PDF
                              </button>
                              <a
                                href={`/admin/generate?cycle_id=${c.id}`}
                                className="btn-ghost text-xs"
                              >
                                Re-generate
                              </a>
                              <button
                                onClick={() => c.report && handleDeleteReport(c.report.id)}
                                disabled={deletingReport === c.report?.id}
                                className="btn-ghost text-xs text-red-500 hover:text-red-700"
                              >
                                {deletingReport === c.report?.id ? '…' : 'Delete'}
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-gray-400 hidden sm:inline">No report</span>
                              <a
                                href={`/admin/generate?cycle_id=${c.id}`}
                                className="btn-primary text-xs"
                              >
                                Generate report
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Submissions accordion */}
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50">
                          {loadingSubmissions === c.id ? (
                            <div className="px-4 py-4 text-sm text-gray-400">Loading submissions…</div>
                          ) : (
                            <div className="px-4 py-3 space-y-2">
                              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                                Submissions
                              </p>
                              {TEAM_MEMBERS.map((member) => {
                                const sub = subs.find((s) => s.person_name === member.name)
                                return (
                                  <SubRow key={member.name} name={member.name} submission={sub} />
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Standalone uploaded reports (no cycle) */}
          {standaloneReports.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Uploaded reports</h2>
              <div className="space-y-2">
                {standaloneReports.map((report) => (
                  <div key={report.id} className="card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{report.period}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {report.type === 'biweekly' ? 'Biweekly' : 'Weekly'} · Uploaded ·{' '}
                          {new Date(report.generated_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handlePrint(report)} className="btn-secondary text-xs">
                          PDF
                        </button>
                        <button
                          onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                          className="btn-ghost text-xs"
                        >
                          {expandedReport === report.id ? 'Collapse' : 'Preview'}
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deletingReport === report.id}
                          className="btn-ghost text-xs text-red-500 hover:text-red-700"
                        >
                          {deletingReport === report.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    {expandedReport === report.id && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                          {report.content}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function SubRow({ name, submission }: { name: string; submission?: Submission }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border border-gray-200 overflow-hidden bg-white">
      <button
        onClick={() => submission && setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
          submission ? 'hover:bg-gray-50' : 'opacity-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${submission ? 'bg-green-400' : 'bg-amber-400'}`} />
          <span className="text-sm text-gray-800">{name}</span>
        </div>
        {submission ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {new Date(submission.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        ) : (
          <span className="text-xs text-gray-400">No submission</span>
        )}
      </button>
      {expanded && submission && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-2">
          <SubField label="Headline" value={submission.headline} />
          <SubField label="Progress" value={submission.progress} />
          <SubField label="Risks" value={submission.risks} />
          {submission.metrics && <SubField label="Metrics" value={submission.metrics} />}
          {submission.board_update && <SubField label="Board update" value={submission.board_update} />}
          {submission.focus && <SubField label="Focus" value={submission.focus} />}
          {submission.priorities && <SubField label="Priorities" value={submission.priorities} />}
        </div>
      )}
    </div>
  )
}

function SubField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{value}</p>
    </div>
  )
}
