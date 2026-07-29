'use client'

import { useState } from 'react'
import type { Submission, DraftFields } from '@/types'
import DraftAssistant from './DraftAssistant'

interface Props {
  cycleId: number
  personName: string
  existing: Submission | null
  onClose: () => void
  onSaved: (submission: Submission) => void
}

export default function AdminSubmissionEditor({ cycleId, personName, existing, onClose, onSaved }: Props) {
  const [headline, setHeadline] = useState(existing?.headline ?? '')
  const [progress, setProgress] = useState(existing?.progress ?? '')
  const [risks, setRisks] = useState(existing?.risks ?? '')
  const [metrics, setMetrics] = useState(existing?.metrics ?? '')
  const [boardUpdate, setBoardUpdate] = useState(existing?.board_update ?? '')
  const [focus, setFocus] = useState(existing?.focus ?? '')
  const [priorities, setPriorities] = useState(existing?.priorities ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function applyDraft(fields: DraftFields) {
    if (fields.headline) setHeadline(fields.headline)
    if (fields.progress) setProgress(fields.progress)
    if (fields.risks) setRisks(fields.risks)
    if (fields.metrics) setMetrics(fields.metrics)
    if (fields.board) setBoardUpdate(fields.board)
    if (fields.focus) setFocus(fields.focus)
    if (fields.priorities) setPriorities(fields.priorities)
  }

  async function handleSave() {
    if (!headline.trim() || !progress.trim() || !risks.trim()) {
      setError('Headline, progress, and risks are required (use "None" if not applicable).')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_id: cycleId,
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
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      onSaved(data.submission)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="card w-full max-w-2xl p-6 space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {existing ? 'Edit input' : 'Add input'} — {personName}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Editing on behalf of {personName}. Saving updates their submission for this cycle.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm" aria-label="Close">✕</button>
        </div>

        {/* Draft assistant — paste their notes to auto-fill */}
        <DraftAssistant personName={personName} onDraft={applyDraft} />

        <div>
          <label className="label">Headline *</label>
          <input type="text" className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div>
          <label className="label">Progress / wins *</label>
          <textarea className="textarea min-h-[90px]" value={progress} onChange={(e) => setProgress(e.target.value)} />
        </div>
        <div>
          <label className="label">Risks / issues *</label>
          <textarea className="textarea min-h-[70px]" value={risks} onChange={(e) => setRisks(e.target.value)} />
        </div>
        <div>
          <label className="label">Key metrics</label>
          <textarea className="textarea min-h-[60px]" value={metrics} onChange={(e) => setMetrics(e.target.value)} />
        </div>
        <div>
          <label className="label">Board-relevant update</label>
          <textarea className="textarea min-h-[60px]" value={boardUpdate} onChange={(e) => setBoardUpdate(e.target.value)} />
        </div>
        <div>
          <label className="label">Focus last period</label>
          <textarea className="textarea min-h-[60px]" value={focus} onChange={(e) => setFocus(e.target.value)} />
        </div>
        <div>
          <label className="label">Next period priorities</label>
          <textarea className="textarea min-h-[60px]" value={priorities} onChange={(e) => setPriorities(e.target.value)} />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save input'}
          </button>
        </div>
      </div>
    </div>
  )
}
