'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Cycle, Submission } from '@/types'
import { TEAM_MEMBERS } from '@/lib/team'
import { buildPrintHtml, fetchLogoBase64 } from '@/lib/report-html'

function draftKey(cycleId: number | null) {
  return `report_draft_${cycleId ?? 'none'}`
}

function GeneratePageInner() {
  const searchParams = useSearchParams()
  const urlCycleId = searchParams.get('cycle_id') ? Number(searchParams.get('cycle_id')) : null

  const [period, setPeriod] = useState('')
  const [type, setType] = useState<'weekly' | 'biweekly'>('biweekly')
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [allCycles, setAllCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(urlCycleId)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [hasDraft, setHasDraft] = useState(false)

  // Load cycles on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/submissions').then(r => r.json()),
      fetch('/api/cycles').then(r => r.json()),
    ]).then(([subData, cycleData]) => {
      const cycles: Cycle[] = cycleData.cycles ?? []
      setAllCycles(cycles)

      if (urlCycleId) {
        const c = cycles.find(c => c.id === urlCycleId)
        if (c) { setPeriod(c.label); setType(c.type) }
      } else if (subData.cycle) {
        setSelectedCycleId(subData.cycle.id)
        setPeriod(subData.cycle.label)
        setType(subData.cycle.type)
      } else if (cycles.length > 0) {
        const latest = cycles[0]
        setSelectedCycleId(latest.id)
        setPeriod(latest.label)
        setType(latest.type)
      }
    }).catch(() => {})
  }, [urlCycleId])

  // Load submissions and check for draft whenever selected cycle changes
  useEffect(() => {
    if (!selectedCycleId) return

    fetch(`/api/submissions?cycle_id=${selectedCycleId}`)
      .then(r => r.json())
      .then(data => setSubmissions(data.submissions ?? []))
      .catch(() => {})

    const draft = localStorage.getItem(draftKey(selectedCycleId))
    if (draft) {
      setHasDraft(true)
      // Only auto-restore if editor is empty
      setContent(prev => prev || draft)
    } else {
      setHasDraft(false)
    }
  }, [selectedCycleId])

  // Auto-save draft to localStorage on every content change
  useEffect(() => {
    if (!content || !selectedCycleId) return
    localStorage.setItem(draftKey(selectedCycleId), content)
    setHasDraft(true)
  }, [content, selectedCycleId])

  function handleCycleSelect(cycleId: number) {
    const c = allCycles.find(c => c.id === cycleId)
    if (c) {
      setSelectedCycleId(c.id)
      setPeriod(c.label)
      setType(c.type)
      setContent('')
      setSaved(false)
      setError('')
    }
  }

  function handleRestoreDraft() {
    const draft = localStorage.getItem(draftKey(selectedCycleId))
    if (draft) { setContent(draft); setSaved(false) }
  }

  function handleDiscardDraft() {
    localStorage.removeItem(draftKey(selectedCycleId))
    setContent('')
    setHasDraft(false)
    setSaved(false)
  }

  async function handleGenerate() {
    if (!period.trim()) return
    setGenerating(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, type, cycle_id: selectedCycleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setContent(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period, type, content,
          cycle_id: selectedCycleId ?? null,
          source: 'generated',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      // Clear draft once officially saved
      localStorage.removeItem(draftKey(selectedCycleId))
      setHasDraft(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint() {
    const logo = await fetchLogoBase64()
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildPrintHtml(period, content, logo))
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const selectedCycle = allCycles.find(c => c.id === selectedCycleId)
  const submitted = TEAM_MEMBERS.filter(m => submissions.some(s => s.person_name === m.name))
  const pending = TEAM_MEMBERS.filter(m => !submissions.some(s => s.person_name === m.name))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/archive" className="text-xs text-gray-400 hover:text-gray-600">
          ← Archive
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Generate report</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="card p-4 space-y-4">

            {allCycles.length > 0 && (
              <div>
                <label className="label">Cycle</label>
                <select
                  className="input"
                  value={selectedCycleId ?? ''}
                  onChange={(e) => handleCycleSelect(Number(e.target.value))}
                >
                  {allCycles.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}{c.is_current ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">Report period label</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. May 13 – 24"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
              <p className="field-hint">Used in the report header — edit if needed.</p>
            </div>

            <div>
              <label className="label">Report type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as 'weekly' | 'biweekly')}
              >
                <option value="biweekly">Biweekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            {selectedCycle && (
              <div className="bg-gray-50 rounded px-3 py-2 text-xs text-gray-500">
                Pulling submissions from: <span className="font-medium text-gray-700">{selectedCycle.label}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || !period.trim()}
              className="btn-primary w-full"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </span>
              ) : 'Generate report'}
            </button>
          </div>

          {/* Submission status */}
          {selectedCycle && (
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Submissions — {selectedCycle.label}
              </p>
              <div className="space-y-1">
                {submitted.map(m => (
                  <div key={m.name} className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    {m.name}
                  </div>
                ))}
                {pending.map(m => (
                  <div key={m.name} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 flex-shrink-0" />
                    {m.name}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">{submitted.length} of {TEAM_MEMBERS.length} submitted</p>
            </div>
          )}

          {content && (
            <div className="card p-4 space-y-2">
              <button onClick={handlePrint} className="btn-secondary w-full text-sm">
                Download PDF
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="btn-primary w-full text-sm"
              >
                {saving ? 'Saving…' : saved ? '✓ Saved to archive' : 'Save to archive'}
              </button>
              {!saved && (
                <p className="text-xs text-amber-600 text-center">Not yet saved to archive</p>
              )}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          {/* Draft restore banner */}
          {hasDraft && !content && (
            <div className="mb-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <p className="text-xs text-amber-700">You have an unsaved draft for this cycle.</p>
              <div className="flex gap-2 ml-3 flex-shrink-0">
                <button onClick={handleRestoreDraft} className="text-xs text-amber-700 underline hover:text-amber-900">
                  Restore
                </button>
                <button onClick={handleDiscardDraft} className="text-xs text-gray-400 hover:text-gray-600">
                  Discard
                </button>
              </div>
            </div>
          )}

          {content ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Edit below if needed, then save to archive and/or download PDF.</p>
              <textarea
                className="textarea font-mono text-xs min-h-[600px]"
                value={content}
                onChange={(e) => { setContent(e.target.value); setSaved(false) }}
              />
            </div>
          ) : (
            <div className="card p-8 text-center text-sm text-gray-500 min-h-[300px] flex items-center justify-center">
              {generating ? (
                <div className="space-y-3">
                  <svg className="animate-spin w-8 h-8 text-brand-500 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p>Generating from {selectedCycle?.label ?? 'submissions'} using Claude…</p>
                  <p className="text-xs text-gray-400">This takes 15–30 seconds.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-gray-700">Ready to generate</p>
                  <p className="text-gray-400 text-xs">
                    {selectedCycle
                      ? `Using ${selectedCycle.label} submissions`
                      : 'Select a cycle and click Generate'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
      <GeneratePageInner />
    </Suspense>
  )
}
