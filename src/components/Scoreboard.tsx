'use client'

import type { SubmissionStatus, Cycle } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  statuses: SubmissionStatus[]
  cycle: Cycle | null
}

export default function Scoreboard({ statuses, cycle }: Props) {
  const submitted = statuses.filter((s) => s.submitted).length
  const total = statuses.length
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0
  const allIn = submitted === total

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Submission status</h2>
          {cycle ? (
            <p className="text-xs text-gray-500 mt-0.5">{cycle.label}</p>
          ) : (
            <p className="text-xs text-amber-600 mt-0.5">No active cycle — contact admin</p>
          )}
        </div>
        <span className="text-sm font-medium text-gray-700">
          {submitted}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${allIn ? 'bg-green-500' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Member grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {statuses.map((s) => (
          <div key={s.name} className="flex items-center gap-2 py-1">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                s.submitted ? 'bg-green-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-sm text-gray-700 truncate">{s.firstName}</span>
            {s.submitted && s.submitted_at && (
              <span className="text-xs text-gray-400 ml-auto hidden sm:block">
                {new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Deadline reminder */}
      {cycle && !allIn && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
          Deadline:{' '}
          <span className="font-medium text-gray-700">
            {new Date(cycle.closes_at).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
          </span>
          {' '}·{' '}
          {formatDistanceToNow(new Date(cycle.closes_at), { addSuffix: true })}
        </div>
      )}

      {allIn && cycle && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-green-600 font-medium">
          ✓ All submissions received
        </div>
      )}
    </div>
  )
}
