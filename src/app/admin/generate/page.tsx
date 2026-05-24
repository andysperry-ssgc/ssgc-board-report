'use client'

import { useState, useEffect } from 'react'
import type { Cycle } from '@/types'

export default function GeneratePage() {
  const [period, setPeriod] = useState('')
  const [type, setType] = useState<'weekly' | 'biweekly'>('biweekly')
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cycle, setCycle] = useState<Cycle | null>(null)

  useEffect(() => {
    fetch('/api/submissions')
      .then((r) => r.json())
      .then((data) => {
        if (data.cycle) {
          setCycle(data.cycle)
          setPeriod(data.cycle.label)
          setType(data.cycle.type)
        }
      })
      .catch(() => {})
  }, [])

  async function handleGenerate() {
    if (!period.trim()) return
    setGenerating(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          type,
          cycle_id: cycle?.id,
        }),
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
          period,
          type,
          content,
          cycle_id: cycle?.id ?? null,
          source: 'generated',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${period} — SafeSpace Global Board Report</title>
          <style>
            body { font-family: Georgia, serif; max-width: 750px; margin: 40px auto; color: #111; line-height: 1.65; font-size: 11pt; }
            pre { white-space: pre-wrap; font-family: Georgia, serif; }
          </style>
        </head>
        <body><pre>${content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body>
      </html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Generate report</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <div>
              <label className="label">Reporting period</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. May 26 – Jun 6"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
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
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}
          {content ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Edit below before saving or printing.</p>
              </div>
              <textarea
                className="textarea font-mono text-xs min-h-[600px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          ) : (
            <div className="card p-8 text-center text-sm text-gray-500 h-full flex items-center justify-center">
              {generating ? (
                <div className="space-y-2">
                  <svg className="animate-spin w-8 h-8 text-brand-500 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p>Generating report from {cycle ? cycle.label : 'submissions'} using Claude…</p>
                </div>
              ) : (
                <p>Set the period and click Generate to create the board report.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
