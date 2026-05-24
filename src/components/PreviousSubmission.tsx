'use client'

import { useState } from 'react'
import type { Submission } from '@/types'

interface Props {
  submission: Submission
}

export default function PreviousSubmission({ submission }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">Previous submission reference</span>
        <span className="text-xs text-gray-400 flex items-center gap-2">
          <span className="hidden sm:block">
            {new Date(submission.submitted_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
          <p className="text-xs text-gray-400 mb-3">Read-only — for reference only</p>
          <Field label="Headline" value={submission.headline} />
          <Field label="Progress / wins" value={submission.progress} />
          <Field label="Risks / issues" value={submission.risks} />
          {submission.metrics && <Field label="Key metrics" value={submission.metrics} />}
          {submission.board_update && <Field label="Board-relevant update" value={submission.board_update} />}
          {submission.focus && <Field label="Focus last period" value={submission.focus} />}
          {submission.priorities && <Field label="Next period priorities" value={submission.priorities} />}
        </div>
      )}
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
