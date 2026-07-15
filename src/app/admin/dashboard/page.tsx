'use client'

import { useState, useEffect } from 'react'
import type { Cycle, Submission, SubmissionStatus } from '@/types'
import { mergeRoster } from '@/lib/team'
import { buildPrintHtml, fetchLogoBase64 } from '@/lib/report-html'

export default function Dashboard() {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // New cycle modal
  const [showNewCycle, setShowNewCycle] = useState(false)
  const [cycleForm, setCycleForm] = useState({
    label: '',
    type: 'biweekly' as 'weekly' | 'biweekly',
    opens_at: '',
    closes_at: '',
  })
  const [cycleError, setCycleError] = useState('')
  const [cycleLoading, setCycleLoading] = useState(false)

  // Generate panel
  const [generating, setGenerating] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [subRes, reportRes] = await Promise.all([
        fetch('/api/submissions'),
        fetch('/api/reports'),
      ])
      const subData = await subRes.json()
      const reportData = await reportRes.json()

      const currentCycle = subData.cycle ?? null
      setCycle(currentCycle)
      setSubmissions(subData.submissions ?? [])
      setStatuses(subData.statuses ?? [])

      // Pre-load any existing report for the current cycle
      if (currentCycle) {
        const existing = (reportData.reports ?? []).find(
          (r: { cycle_id: number; content: string }) => r.cycle_id === currentCycle.id
        )
        if (existing) {
          setReportContent(existing.content)
          setSaved(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault()
    setCycleLoading(true)
    setCycleError('')
    try {
      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cycleForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create cycle')
      setShowNewCycle(false)
      setCycleForm({ label: '', type: 'biweekly', opens_at: '', closes_at: '' })
      await load()
    } catch (err) {
      setCycleError(err instanceof Error ? err.message : 'Error')
    } finally {
      setCycleLoading(false)
    }
  }

  async function handleGenerate() {
    if (!cycle) return
    setGenerating(true)
    setGenerateError('')
    setSaved(false)
    setReportContent('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: cycle.label, type: cycle.type, cycle_id: cycle.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setReportContent(data.content)
      // Scroll to the generate section
      setTimeout(() => {
        document.getElementById('generate-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!reportContent.trim() || !cycle) return
    setSaving(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: cycle.label,
          type: cycle.type,
          content: reportContent,
          cycle_id: cycle.id,
          source: 'generated',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint() {
    const logo = await fetchLogoBase64()
    const win = window.open('', '_blank')
    if (!win || !cycle) return
    win.document.write(buildPrintHtml(cycle.label, reportContent, logo))
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const submitted = statuses.filter((s) => s.submitted).length
  const total = statuses.length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <button onClick={() => setShowNewCycle(true)} className="btn-primary text-sm">
          + New cycle
        </button>
      </div>

      {/* New cycle modal */}
      {showNewCycle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Open new cycle</h2>
            <p className="text-xs text-gray-400 mb-4">All times are CT (Central Time)</p>
            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div>
                <label className="label">Cycle label</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. May 26 – Jun 6"
                  value={cycleForm.label}
                  onChange={(e) => setCycleForm({ ...cycleForm, label: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={cycleForm.type}
                  onChange={(e) => setCycleForm({ ...cycleForm, type: e.target.value as 'weekly' | 'biweekly' })}
                >
                  <option value="biweekly">Biweekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="label">Opens at</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={cycleForm.opens_at}
                  onChange={(e) => setCycleForm({ ...cycleForm, opens_at: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Closes at</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={cycleForm.closes_at}
                  onChange={(e) => setCycleForm({ ...cycleForm, closes_at: e.target.value })}
                  required
                />
              </div>
              {cycleError && <p className="text-sm text-red-600">{cycleError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewCycle(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={cycleLoading} className="btn-primary">
                  {cycleLoading ? 'Creating…' : 'Create cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Current cycle" value={cycle?.label ?? 'None'} />
            <Stat label="Submitted" value={`${submitted}/${total}`} />
            <Stat label="Pending" value={`${total - submitted}`} />
            <Stat
              label="Deadline"
              value={
                cycle
                  ? new Date(cycle.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'
              }
            />
          </div>

          {/* Submissions */}
          {!cycle ? (
            <div className="card p-6 text-center space-y-3">
              <p className="text-sm text-gray-500">No active cycle.</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setShowNewCycle(true)} className="btn-primary text-sm">
                  + New cycle
                </button>
                <a href="/admin/archive" className="btn-secondary text-sm">
                  View archive &amp; generate reports →
                </a>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Submissions — {cycle.label}</h2>
              <div className="space-y-2">
                {mergeRoster(statuses, submissions).map((member) => {
                  const sub = submissions.find((s) => s.person_name === member.name)
                  const isExpanded = expanded === member.name

                  return (
                    <div key={member.name} className="card overflow-hidden">
                      <button
                        onClick={() => sub && setExpanded(isExpanded ? null : member.name)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left ${sub ? 'hover:bg-gray-50' : ''} transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              sub ? 'bg-green-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className="text-sm font-medium text-gray-900">{member.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {sub ? (
                            <span className="text-xs text-gray-500">
                              {new Date(sub.submitted_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600">Pending</span>
                          )}
                          {sub && (
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {isExpanded && sub && (
                        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                          <Field label="Headline" value={sub.headline} />
                          <Field label="Progress / wins" value={sub.progress} />
                          <Field label="Risks / issues" value={sub.risks} />
                          {sub.metrics && <Field label="Key metrics" value={sub.metrics} />}
                          {sub.board_update && <Field label="Board-relevant update" value={sub.board_update} />}
                          {sub.focus && <Field label="Focus last period" value={sub.focus} />}
                          {sub.priorities && <Field label="Next period priorities" value={sub.priorities} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Generate report panel */}
          {cycle && (
            <div id="generate-panel" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Generate report — {cycle.label}</h2>
                {reportContent && (
                  <div className="flex items-center gap-2">
                    <button onClick={handlePrint} className="btn-secondary text-xs">
                      Download PDF
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || saved}
                      className="btn-primary text-xs"
                    >
                      {saving ? 'Saving…' : saved ? '✓ Saved to archive' : 'Save to archive'}
                    </button>
                  </div>
                )}
              </div>

              {generateError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {generateError}
                </div>
              )}

              {reportContent ? (
                <div className="space-y-2">
                  {!saved && (
                    <p className="text-xs text-amber-600">Not yet saved to archive — save when ready.</p>
                  )}
                  <textarea
                    className="textarea font-mono text-xs min-h-[500px]"
                    value={reportContent}
                    onChange={(e) => { setReportContent(e.target.value); setSaved(false) }}
                  />
                </div>
              ) : (
                <div className="card p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {generating ? 'Generating report…' : 'Ready to generate'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {generating
                        ? 'This takes 15–30 seconds.'
                        : `Using ${submitted} of ${total} submissions from ${cycle.label}`}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-primary text-sm flex-shrink-0"
                  >
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </span>
                    ) : 'Generate report'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}
