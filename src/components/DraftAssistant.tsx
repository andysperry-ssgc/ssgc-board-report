'use client'

import { useState } from 'react'
import type { DraftFields } from '@/types'

interface Props {
  personName: string
  onDraft: (fields: DraftFields) => void
}

export default function DraftAssistant({ personName, onDraft }: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!notes.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_name: personName, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate draft')
      onDraft(data.draft)
      setOpen(false)
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Draft assistant</span>
          <span className="text-xs text-gray-400">— paste notes, get a draft</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4">
          <label className="label">Your notes / activity log</label>
          <textarea
            className="textarea min-h-[120px]"
            placeholder="Paste meeting notes, Slack threads, activity summaries — anything from the past two weeks. The AI will extract and draft your form fields."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">Draft populates all form fields — you can edit before submitting.</p>
            <button
              onClick={handleGenerate}
              disabled={!notes.trim() || loading}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Drafting…
                </span>
              ) : 'Generate draft'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
