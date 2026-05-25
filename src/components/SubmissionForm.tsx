'use client'

import { useState, useEffect } from 'react'
import type { Submission, DraftFields } from '@/types'
import DraftAssistant from './DraftAssistant'
import PreviousSubmission from './PreviousSubmission'
import SaveCopyPanel from './SaveCopyPanel'

interface Props {
  personName: string
  onSuccess: (submission: Submission) => void
}

export default function SubmissionForm({ personName, onSuccess }: Props) {
  const [headline, setHeadline] = useState('')
  const [progress, setProgress] = useState('')
  const [risks, setRisks] = useState('')
  const [metrics, setMetrics] = useState('')
  const [boardUpdate, setBoardUpdate] = useState('')
  const [focus, setFocus] = useState('')
  const [priorities, setPriorities] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<Submission | null>(null)
  const [previousSub, setPreviousSub] = useState<Submission | null>(null)
  const [existingSub, setExistingSub] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // Load current cycle submission + previous cycle submission when person changes
  useEffect(() => {
    if (!personName) return
    setLoading(true)
    setSubmitted(null)
    setExistingSub(null)
    setPreviousSub(null)
    setEditing(false)

    Promise.all([
      fetch(`/api/submissions/current?person=${encodeURIComponent(personName)}`).then(r => r.json()),
      fetch(`/api/submissions/previous?person=${encodeURIComponent(personName)}`).then(r => r.json()),
    ]).then(([currentData, prevData]) => {
      const current = currentData.submission ?? null
      setExistingSub(current)
      setPreviousSub(prevData.previous ?? null)

      if (current) {
        // Pre-fill form with existing submission
        setHeadline(current.headline ?? '')
        setProgress(current.progress ?? '')
        setRisks(current.risks ?? '')
        setMetrics(current.metrics ?? '')
        setBoardUpdate(current.board_update ?? '')
        setFocus(current.focus ?? '')
        setPriorities(current.priorities ?? '')
        setSubmitted(current)
      } else {
        // Clear form for new submission
        setHeadline('')
        setProgress('')
        setRisks('')
        setMetrics('')
        setBoardUpdate('')
        setFocus('')
        setPriorities('')
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [personName])

  function applyDraft(fields: DraftFields) {
    if (fields.headline) setHeadline(fields.headline)
    if (fields.progress) setProgress(fields.progress)
    if (fields.risks) setRisks(fields.risks)
    if (fields.metrics) setMetrics(fields.metrics)
    if (fields.board) setBoardUpdate(fields.board)
    if (fields.focus) setFocus(fields.focus)
    if (fields.priorities) setPriorities(fields.priorities)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!headline.trim() || !progress.trim() || !risks.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name: personName,
          headline: headline.trim(),
          progress: progress.trim(),
          risks: risks.trim(),
          metrics: metrics.trim() || undefined,
          board_update: boardUpdate.trim() || undefined,
          focus: focus.trim() || undefined,
          priorities: priorities.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setSubmitted(data.submission)
      setExistingSub(data.submission)
      setEditing(false)
      onSuccess(data.submission)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6 animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    )
  }

  // Show save-a-copy panel when submitted and not editing
  if (submitted && !editing) {
    return (
      <div className="space-y-3">
        <SaveCopyPanel submission={submitted} />
        <div className="flex justify-end">
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary text-sm"
          >
            Edit submission
          </button>
        </div>
      </div>
    )
  }

  const isUpdate = !!existingSub

  return (
    <div className="space-y-4">
      {/* Draft assistant */}
      <DraftAssistant personName={personName} onDraft={applyDraft} />

      {/* Previous cycle submission reference */}
      {previousSub && (
        <PreviousSubmission submission={previousSub} />
      )}

      {/* Main form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-base font-semibold text-gray-900">
              {isUpdate ? 'Update your submission' : 'Your update'} — {personName}
            </h2>
            {isUpdate && (
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                Previously submitted
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">Required fields are marked with *</p>
        </div>

        {/* Required fields */}
        <div>
          <label className="label">Headline *</label>
          <input
            type="text"
            className="input"
            placeholder="Most important outcome from this period"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Progress / wins *</label>
          <textarea
            className="textarea min-h-[100px]"
            placeholder="What got done. Key milestones, deals, completions."
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Risks / issues *</label>
          <textarea
            className="textarea min-h-[80px]"
            placeholder="Blockers, issues, concerns. Write 'None' if clean."
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
            required
          />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white text-xs text-gray-400">Optional — include if relevant</span>
          </div>
        </div>

        {/* Optional fields */}
        <div>
          <label className="label">Key metrics</label>
          <textarea
            className="textarea min-h-[70px]"
            placeholder="Specific numbers, measurable results"
            value={metrics}
            onChange={(e) => setMetrics(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Board-relevant update</label>
          <textarea
            className="textarea min-h-[70px]"
            placeholder="Governance, capital, strategic, investor-facing items"
            value={boardUpdate}
            onChange={(e) => setBoardUpdate(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Focus last period</label>
          <textarea
            className="textarea min-h-[70px]"
            placeholder="What you were primarily working on — 3 bullets max"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Next period priorities</label>
          <textarea
            className="textarea min-h-[70px]"
            placeholder="What you plan to focus on next"
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
          )}
          <button type="submit" disabled={submitting} className="btn-primary ml-auto">
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : isUpdate ? 'Update submission' : 'Submit update'}
          </button>
        </div>
      </form>
    </div>
  )
}
