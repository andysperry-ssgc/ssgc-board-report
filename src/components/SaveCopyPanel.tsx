'use client'

import { useState } from 'react'
import type { Submission } from '@/types'

interface Props {
  submission: Submission
}

function formatSubmission(s: Submission): string {
  const lines: string[] = [
    `SafeSpace Global Board Report Submission`,
    `Submitted: ${new Date(s.submitted_at).toLocaleString()}`,
    ``,
    `HEADLINE`,
    s.headline,
    ``,
    `PROGRESS / WINS`,
    s.progress,
    ``,
    `RISKS / ISSUES`,
    s.risks,
  ]
  if (s.metrics) { lines.push('', 'KEY METRICS', s.metrics) }
  if (s.board_update) { lines.push('', 'BOARD-RELEVANT UPDATE', s.board_update) }
  if (s.focus) { lines.push('', 'FOCUS LAST PERIOD', s.focus) }
  if (s.priorities) { lines.push('', 'NEXT PERIOD PRIORITIES', s.priorities) }
  return lines.join('\n')
}

export default function SaveCopyPanel({ submission }: Props) {
  const [copied, setCopied] = useState(false)

  const text = formatSubmission(submission)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card p-5 border-green-200 bg-green-50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-green-800">✓ Submission received</h3>
          <p className="text-xs text-green-700 mt-0.5">Save a copy for your records</p>
        </div>
        <button onClick={handleCopy} className="btn-secondary text-xs">
          {copied ? '✓ Copied!' : 'Copy to clipboard'}
        </button>
      </div>
      <pre className="text-xs text-gray-600 bg-white border border-green-200 rounded p-3 whitespace-pre-wrap overflow-auto max-h-64 font-mono leading-relaxed select-all">
        {text}
      </pre>
    </div>
  )
}
