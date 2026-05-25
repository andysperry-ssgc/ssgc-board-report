'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import Scoreboard from '@/components/Scoreboard'
import SubmissionForm from '@/components/SubmissionForm'
import { TEAM_MEMBERS } from '@/lib/team'
import type { Cycle, Submission, SubmissionStatus } from '@/types'

export default function HomePage() {
  const [selectedName, setSelectedName] = useState('')
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/submissions')
      const data = await res.json()
      setCycle(data.cycle)
      setStatuses(data.statuses ?? [])
    } catch {
      // silently fail — scoreboard may not update
    } finally {
      setLoading(false)
    }
  }

  function handleSuccess(submission: Submission) {
    fetchStatus()
  }

  const isClosed = cycle ? new Date() > new Date(cycle.closes_at) : false

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Board Report Submission</h1>
          <p className="text-sm text-gray-500 mt-1">SafeSpace Global — Leadership team</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Scoreboard */}
          <div className="lg:col-span-1">
            {loading ? (
              <div className="card p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 rounded" />
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded w-3/4" />
                  ))}
                </div>
              </div>
            ) : (
              <Scoreboard statuses={statuses} cycle={cycle} isClosed={isClosed} />
            )}
          </div>

          {/* Right: content area */}
          <div className="lg:col-span-2 space-y-4">

            {/* Closed banner */}
            {!loading && isClosed && (
              <div className="card p-6 border-gray-200 bg-gray-50 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">Submissions are closed</p>
                <p className="text-sm text-gray-500">
                  The {cycle?.label} submission window has ended.
                  The report is being prepared and will be distributed shortly.
                </p>
              </div>
            )}

            {/* No cycle */}
            {!loading && !cycle && (
              <div className="card p-8 text-center">
                <p className="text-sm text-gray-500">No active submission cycle. Check back soon.</p>
              </div>
            )}

            {/* Active cycle — name picker + form */}
            {!loading && cycle && !isClosed && (
              <>
                <div className="card p-4">
                  <label className="label">Who are you?</label>
                  <select
                    className="input"
                    value={selectedName}
                    onChange={(e) => setSelectedName(e.target.value)}
                  >
                    <option value="">— Select your name —</option>
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedName ? (
                  <SubmissionForm
                    key={selectedName}
                    personName={selectedName}
                    onSuccess={handleSuccess}
                  />
                ) : (
                  <div className="card p-8 text-center">
                    <p className="text-sm text-gray-500">Select your name above to submit your update.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
