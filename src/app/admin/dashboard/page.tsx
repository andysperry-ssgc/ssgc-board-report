'use client'

import { useState, useEffect } from 'react'
import type { Cycle, Submission, SubmissionStatus } from '@/types'
import { TEAM_MEMBERS } from '@/lib/team'

export default function Dashboard() {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewCycle, setShowNewCycle] = useState(false)
  const [cycleForm, setCycleForm] = useState({
    label: '',
    type: 'biweekly' as 'weekly' | 'biweekly',
    opens_at: '',
    closes_at: '',
  })
  const [cycleError, setCycleError] = useState('')
  const [cycleLoading, setCycleLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/submissions')
      const data = await res.json()
      setCycle(data.cycle)
      setSubmissions(data.submissions ?? [])
      setStatuses(data.statuses ?? [])
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

  const submitted = statuses.filter((s) => s.submitted).length
  const total = statuses.length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
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
        <div className="space-y-6">
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

          {/* Submission cards */}
          {!cycle ? (
            <div className="card p-6 text-center text-sm text-gray-500">
              No active cycle. Create one to get started.
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Submissions</h2>
              <div className="space-y-2">
                {TEAM_MEMBERS.map((member) => {
                  const status = statuses.find((s) => s.name === member.name)
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
                              status?.submitted ? 'bg-green-400' : 'bg-amber-400'
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
        </div>
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
