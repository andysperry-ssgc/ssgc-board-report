'use client'

import type { SubmissionStatus, Cycle } from '@/types'

interface Props {
  statuses: SubmissionStatus[]
  cycle: Cycle | null
}

export default function Scoreboard({ statuses, cycle }: Props) {
  const submitted = statuses.filter((s) => s.submitted)
  const pending = statuses.filter((s) => !s.submitted)
  const total = statuses.length
  const pct = total > 0 ? Math.round((submitted.length / total) * 100) : 0
  const allIn = submitted.length === total

  const deadlineDisplay = cycle
    ? new Date(cycle.closes_at).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Submission status</h2>
          {cycle ? (
            <p className="text-xs text-gray-500 mt-0.5">{cycle.label}</p>
          ) : (
            <p className="text-xs text-amber-600 mt-0.5">No active cycle</p>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-700">
          {submitted.length}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${allIn ? 'bg-green-500' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Submitted */}
      {submitted.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Submitted</p>
          <div className="space-y-1.5">
            {submitted.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-sm text-gray-800">{s.firstName}</span>
                </div>
                {s.submitted_at && (
                  <span className="text-xs text-gray-400">
                    {new Date(s.submitted_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Waiting on</p>
          <div className="space-y-1.5">
            {pending.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-sm text-gray-500">{s.firstName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadline */}
      {deadlineDisplay && !allIn && (
        <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
          Deadline: <span className="font-medium text-gray-700">{deadlineDisplay}</span>
        </div>
      )}

      {allIn && (
        <div className="pt-3 border-t border-gray-100 text-xs text-green-600 font-medium">
          ✓ All submissions received
        </div>
      )}
    </div>
  )
}
