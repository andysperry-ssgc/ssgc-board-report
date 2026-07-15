'use client'

import { useState, useEffect } from 'react'
import type { Cycle, Submission, SubmissionStatus, TeamMember } from '@/types'
import { mergeRoster } from '@/lib/team'

export default function SubmissionsPage() {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([])
  const [allCycles, setAllCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)
  const [cycleSubmissions, setCycleSubmissions] = useState<Submission[]>([])
  const [cycleStatuses, setCycleStatuses] = useState<SubmissionStatus[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [subRes, cycleRes] = await Promise.all([
        fetch('/api/submissions'),
        fetch('/api/cycles'),
      ])
      const subData = await subRes.json()
      const cycleData = await cycleRes.json()
      setCycle(subData.cycle)
      setSubmissions(subData.submissions ?? [])
      setStatuses(subData.statuses ?? [])
      setAllCycles(cycleData.cycles ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function loadCycleSubmissions(cycleId: number) {
    setSelectedCycleId(cycleId)
    const res = await fetch(`/api/submissions?cycle_id=${cycleId}`)
    const data = await res.json()
    setCycleSubmissions(data.submissions ?? [])
    setCycleStatuses(data.statuses ?? [])
  }

  const pastCycles = allCycles.filter((c) => !c.is_current)

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Submissions</h1>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* Current cycle */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Current cycle{cycle ? ` — ${cycle.label}` : ' — none'}
            </h2>
            {!cycle ? (
              <div className="card p-5 text-sm text-gray-500">No active cycle.</div>
            ) : (
              <SubmissionList
                members={mergeRoster(statuses, submissions)}
                submissions={submissions}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            )}
          </section>

          {/* Archive */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Past cycles</h2>
            {pastCycles.length === 0 ? (
              <div className="card p-5 text-sm text-gray-500">No past cycles.</div>
            ) : (
              <div className="space-y-3">
                {pastCycles.map((c) => (
                  <div key={c.id} className="card overflow-hidden">
                    <button
                      onClick={() =>
                        selectedCycleId === c.id
                          ? setSelectedCycleId(null)
                          : loadCycleSubmissions(c.id)
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900">{c.label}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </button>
                    {selectedCycleId === c.id && (
                      <div className="border-t border-gray-100">
                        <SubmissionList
                          members={mergeRoster(cycleStatuses, cycleSubmissions)}
                          submissions={cycleSubmissions}
                          expanded={expanded}
                          setExpanded={setExpanded}
                          nested
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function SubmissionList({
  members,
  submissions,
  expanded,
  setExpanded,
  nested = false,
}: {
  members: TeamMember[]
  submissions: Submission[]
  expanded: string | null
  setExpanded: (v: string | null) => void
  nested?: boolean
}) {
  return (
    <div className={`space-y-2 ${nested ? 'px-4 py-3' : ''}`}>
      {members.map((member) => {
        const sub = submissions.find((s) => s.person_name === member.name)
        const key = `${member.name}-${sub?.id}`
        const isExpanded = expanded === key

        return (
          <div key={member.name} className={`${nested ? '' : 'card'} overflow-hidden rounded-md border border-gray-200`}>
            <button
              onClick={() => sub && setExpanded(isExpanded ? null : key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left ${sub ? 'hover:bg-gray-50' : 'opacity-60'} transition-colors`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sub ? 'bg-green-400' : 'bg-amber-400'}`} />
                <span className="text-sm text-gray-800">{member.name}</span>
              </div>
              {sub ? (
                <span className="text-xs text-gray-500">
                  {new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              ) : (
                <span className="text-xs text-gray-400">No submission</span>
              )}
            </button>

            {isExpanded && sub && (
              <div className="border-t border-gray-100 px-3 py-3 bg-gray-50 space-y-2">
                <SubField label="Headline" value={sub.headline} />
                <SubField label="Progress" value={sub.progress} />
                <SubField label="Risks" value={sub.risks} />
                {sub.metrics && <SubField label="Metrics" value={sub.metrics} />}
                {sub.board_update && <SubField label="Board update" value={sub.board_update} />}
                {sub.focus && <SubField label="Focus" value={sub.focus} />}
                {sub.priorities && <SubField label="Priorities" value={sub.priorities} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SubField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{value}</p>
    </div>
  )
}
