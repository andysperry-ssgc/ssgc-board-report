'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Cycle, Report, Submission, SubmissionStatus } from '@/types'
import { buildPrintHtml, buildSubmissionsPrintHtml, fetchLogoBase64, printInNewWindow } from '@/lib/report-html'
import AdminSubmissionEditor from '@/components/AdminSubmissionEditor'

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
  const [truncated, setTruncated] = useState(false)
  const [saved, setSaved] = useState(false)
  const [allCycles, setAllCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(urlCycleId)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [manualEdit, setManualEdit] = useState(false)
  const [editingMember, setEditingMember] = useState<string | null>(null)

  // Content as last stored on the server (draft or archived report) — edits
  // that differ from it are unsaved. activeCycle guards against a slow response
  // for a previously selected cycle overwriting the current one.
  const persisted = useRef('')
  const activeCycle = useRef<number | null>(urlCycleId)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ cycleId: urlCycleId as number | null, content: '' })

  async function loadCycleData(cycleId: number) {
    try {
      const res = await fetch(`/api/submissions?cycle_id=${cycleId}`)
      const data = await res.json()
      setSubmissions(data.submissions ?? [])
      setStatuses(data.statuses ?? [])
    } catch {
      // leave existing data in place on failure
    }
  }

  async function putDraft(cycleId: number, text: string): Promise<boolean> {
    setDraftStatus('saving')
    try {
      const res = await fetch('/api/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, content: text }),
      })
      if (!res.ok) throw new Error('Failed to save draft')
      const data = await res.json()
      if (activeCycle.current === cycleId) {
        persisted.current = text
        setDraftSavedAt(data.updated_at ?? new Date().toISOString())
        setDraftStatus('saved')
        setHasDraft(true)
      }
      return true
    } catch {
      if (activeCycle.current === cycleId) setDraftStatus('error')
      return false
    }
  }

  // Save any unsaved edits right away (before switching cycles).
  async function flushDraft() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const { cycleId, content: text } = latest.current
    if (cycleId && text.trim() && text !== persisted.current) await putDraft(cycleId, text)
  }

  // Load what belongs in the editor for a cycle: its server draft if one exists,
  // otherwise its archived report, otherwise nothing.
  async function loadCycleContent(cycleId: number, reportList: Report[]) {
    activeCycle.current = cycleId
    persisted.current = ''
    setContent('')
    setSaved(false)
    setHasDraft(false)
    setDraftStatus('idle')
    setDraftSavedAt(null)
    setManualEdit(false)
    setTruncated(false)

    let draft: { content: string; updated_at: string } | null = null
    try {
      const res = await fetch(`/api/drafts?cycle_id=${cycleId}`)
      if (res.ok) draft = (await res.json()).draft ?? null
    } catch { /* fall through to archived report */ }
    if (activeCycle.current !== cycleId) return

    // One-time move of a draft the previous version kept only in this browser.
    let legacy: string | null = null
    try { legacy = localStorage.getItem(draftKey(cycleId)) } catch { /* storage unavailable */ }
    if (!draft && legacy) {
      setContent(legacy)
      setHasDraft(true)
      if (await putDraft(cycleId, legacy)) {
        try { localStorage.removeItem(draftKey(cycleId)) } catch { /* ignore */ }
      }
      return
    }
    if (legacy) { try { localStorage.removeItem(draftKey(cycleId)) } catch { /* ignore */ } }

    if (draft) {
      persisted.current = draft.content
      setContent(draft.content)
      setHasDraft(true)
      setDraftStatus('saved')
      setDraftSavedAt(draft.updated_at)
      return
    }
    const archived = reportList.find(r => r.cycle_id === cycleId)
    if (archived) {
      persisted.current = archived.content
      setContent(archived.content)
      setSaved(true)
    }
  }

  // Load cycles and reports on mount, then the resolved cycle's content
  useEffect(() => {
    Promise.all([
      fetch('/api/submissions').then(r => r.json()),
      fetch('/api/cycles').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
    ]).then(([subData, cycleData, reportData]) => {
      const cycles: Cycle[] = cycleData.cycles ?? []
      const reportList: Report[] = reportData.reports ?? []
      setAllCycles(cycles)
      setReports(reportList)

      let resolved: Cycle | null = null
      if (urlCycleId) resolved = cycles.find(c => c.id === urlCycleId) ?? null
      else if (subData.cycle) resolved = subData.cycle
      else if (cycles.length > 0) resolved = cycles[0]

      if (resolved) {
        setSelectedCycleId(resolved.id)
        setPeriod(resolved.label)
        setType(resolved.type)
        loadCycleContent(resolved.id, reportList)
      }
    }).catch(() => {})
  }, [urlCycleId])

  // Submissions for the selected cycle
  useEffect(() => {
    if (selectedCycleId) loadCycleData(selectedCycleId)
  }, [selectedCycleId])

  // Autosave: persist edits to the server shortly after typing stops
  useEffect(() => {
    latest.current = { cycleId: selectedCycleId, content }
    if (!selectedCycleId || !content.trim() || content === persisted.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const cycleId = selectedCycleId
    const text = content
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      if (text !== persisted.current) putDraft(cycleId, text)
    }, 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [content, selectedCycleId])

  // Leaving the page (tab close, reload, or in-app navigation) with unsaved
  // edits: send them with keepalive so the request outlives the page.
  useEffect(() => {
    function flushOnExit() {
      const { cycleId, content: text } = latest.current
      if (!cycleId || !text.trim() || text === persisted.current) return
      fetch('/api/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, content: text }),
        keepalive: true,
      }).catch(() => {})
      persisted.current = text
    }
    window.addEventListener('pagehide', flushOnExit)
    return () => { window.removeEventListener('pagehide', flushOnExit); flushOnExit() }
  }, [])

  async function handleCycleSelect(cycleId: number) {
    const c = allCycles.find(c => c.id === cycleId)
    if (!c) return
    await flushDraft()
    setSelectedCycleId(c.id)
    setPeriod(c.label)
    setType(c.type)
    setError('')
    loadCycleContent(c.id, reports)
  }

  async function handleDiscardDraft() {
    if (!selectedCycleId) return
    if (!confirm('Discard this draft? Unsaved changes will be lost. An archived report, if any, is not affected.')) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    try {
      const res = await fetch(`/api/drafts?cycle_id=${selectedCycleId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setError('Could not discard the draft. Please try again.')
      return
    }
    loadCycleContent(selectedCycleId, reports)
  }

  async function handleGenerate() {
    if (!period.trim()) return
    setGenerating(true)
    setError('')
    setTruncated(false)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, type, cycle_id: selectedCycleId }),
      })
      // The response may be a non-JSON platform error page (e.g. a timeout), so
      // read it as text and parse defensively rather than assuming JSON.
      const raw = await res.text()
      let data: { content?: string; truncated?: boolean; error?: string } = {}
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error(
          res.ok
            ? 'Unexpected response from the server. Please try again.'
            : 'Report generation took too long or the server errored. Please try again.'
        )
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setSaved(false)
      setContent(data.content ?? '')
      setTruncated(!!data.truncated)
      // Persist immediately rather than waiting for the autosave delay.
      if (selectedCycleId && data.content?.trim()) putDraft(selectedCycleId, data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    setError('')
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
      const data = await res.json()
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
      persisted.current = content
      setSaved(true)
      if (data.report) {
        setReports(prev => [data.report, ...prev.filter(r => r.cycle_id !== data.report.cycle_id)])
      }
      // The archive now holds this content; the draft is no longer needed.
      if (selectedCycleId) {
        await fetch(`/api/drafts?cycle_id=${selectedCycleId}`, { method: 'DELETE' }).catch(() => {})
      }
      setHasDraft(false)
      setDraftStatus('idle')
      setDraftSavedAt(null)
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
  const submitted = statuses.filter(s => s.submitted)

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

          {/* Submissions — bottom of left rail */}
          {selectedCycle && (
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Submissions — {selectedCycle.label}
              </p>
              <div className="space-y-1">
                {statuses.map(s => (
                  <div key={s.name} className="flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2 text-xs min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.submitted ? 'bg-green-400' : 'bg-amber-300'}`} />
                      <span className={`truncate ${s.submitted ? 'text-gray-700' : 'text-gray-400'}`}>{s.name}</span>
                    </div>
                    <button
                      onClick={() => setEditingMember(s.name)}
                      className="btn-ghost text-xs flex-shrink-0"
                    >
                      {s.submitted ? 'Edit' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">{submitted.length} of {statuses.length} submitted</p>
              <p className="text-xs text-gray-400">
                Add or correct any input on someone&apos;s behalf, then regenerate.
              </p>
              <button
                onClick={() => printInNewWindow(async () =>
                  buildSubmissionsPrintHtml(selectedCycle.label, submissions, statuses, await fetchLogoBase64())
                )}
                disabled={submissions.length === 0}
                className="btn-secondary text-xs w-full"
              >
                Download submissions PDF
              </button>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          {truncated && (
            <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              This report hit the generation length limit and may be cut off at the end. Review the ending before saving or distributing, and regenerate if needed.
            </div>
          )}

          {content || manualEdit ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Edit below if needed, then save to archive and/or download PDF.</p>
              <textarea
                className="textarea font-mono text-xs min-h-[600px]"
                value={content}
                placeholder="Paste or write the report here…"
                autoFocus={manualEdit && !content}
                onChange={(e) => { setContent(e.target.value); setSaved(false) }}
              />
              <div className="flex items-center gap-3 pt-1">
                <button onClick={handlePrint} disabled={!content.trim()} className="btn-secondary text-sm">
                  Download PDF
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || saved || !content.trim()}
                  className="btn-primary text-sm"
                >
                  {saving ? 'Saving…' : saved ? '✓ Saved to archive' : 'Save to archive'}
                </button>
              </div>
              {!saved && (
                <div className="flex items-center justify-between gap-3 text-xs">
                  {draftStatus === 'saving' ? (
                    <p className="text-gray-500">Saving draft…</p>
                  ) : draftStatus === 'error' ? (
                    <p className="text-red-600">
                      Couldn&apos;t save the draft. Keep this tab open.{' '}
                      <button
                        onClick={() => selectedCycleId && putDraft(selectedCycleId, content)}
                        className="underline hover:text-red-800"
                      >
                        Retry
                      </button>
                    </p>
                  ) : draftStatus === 'saved' && draftSavedAt ? (
                    <p className="text-green-700">
                      ✓ Draft saved {new Date(draftSavedAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })} · safe to leave and come back · not yet in the archive
                    </p>
                  ) : (
                    <p className="text-amber-600">Not yet saved</p>
                  )}
                  {hasDraft && (
                    <button onClick={handleDiscardDraft} className="text-gray-400 hover:text-red-600 flex-shrink-0">
                      Discard draft
                    </button>
                  )}
                </div>
              )}
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
                  {selectedCycle && (
                    <button onClick={() => setManualEdit(true)} className="btn-ghost text-xs mt-3">
                      Or paste / write the report yourself
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editingMember && selectedCycleId && (
        <AdminSubmissionEditor
          cycleId={selectedCycleId}
          personName={editingMember}
          existing={submissions.find(s => s.person_name === editingMember) ?? null}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); loadCycleData(selectedCycleId) }}
        />
      )}
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
