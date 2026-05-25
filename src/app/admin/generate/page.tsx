'use client'

import { useState, useEffect } from 'react'
import type { Cycle } from '@/types'

// Convert the plain-text report (with markdown-style formatting) to clean HTML for printing
function reportToHtml(text: string): string {
  const lines = text.split('\n')
  let html = ''
  let inBulletList = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Close bullet list if needed
    if (inBulletList && !line.trim().startsWith('•') && !line.trim().startsWith('*  ') && line.trim() !== '') {
      html += '</ul>'
      inBulletList = false
    }

    // Bold headers: **text** as standalone line → h2
    if (/^\*\*(.+)\*\*$/.test(line.trim())) {
      const heading = line.trim().replace(/^\*\*/, '').replace(/\*\*$/, '')
      html += `<h2>${escHtml(heading)}</h2>`
      continue
    }

    // Italic sub-headers: *text* as standalone line → h3
    if (/^\*([^*]+)\*$/.test(line.trim())) {
      const heading = line.trim().replace(/^\*/, '').replace(/\*$/, '')
      html += `<h3>${escHtml(heading)}</h3>`
      continue
    }

    // Bullet lines starting with • or *
    if (/^[•\*]\s/.test(line.trim())) {
      if (!inBulletList) {
        html += '<ul>'
        inBulletList = true
      }
      const item = line.trim().replace(/^[•\*]\s/, '')
      html += `<li>${renderInline(item)}</li>`
      continue
    }

    // Blank line
    if (line.trim() === '') {
      html += ''
      continue
    }

    // Regular paragraph — render inline formatting
    html += `<p>${renderInline(line)}</p>`
  }

  if (inBulletList) html += '</ul>'
  return html
}

function renderInline(text: string): string {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildPrintHtml(period: string, content: string): string {
  const bodyHtml = reportToHtml(content)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${period} — SafeSpace Global Board Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, -apple-system, sans-serif;
      color: #111;
      font-size: 10.5pt;
      line-height: 1.6;
      padding: 48px 60px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #111;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-name {
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #111;
    }
    .company-tagline {
      font-size: 8.5pt;
      color: #666;
      margin-top: 2px;
    }
    .report-meta {
      text-align: right;
      font-size: 8.5pt;
      color: #555;
      line-height: 1.5;
    }
    .confidential {
      font-size: 8pt;
      color: #888;
      font-style: italic;
      margin-top: 12px;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
    h2 {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111;
      margin-top: 24px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #ddd;
    }
    h3 {
      font-size: 10pt;
      font-weight: 600;
      color: #333;
      margin-top: 14px;
      margin-bottom: 4px;
    }
    p { margin-bottom: 8px; }
    ul {
      padding-left: 18px;
      margin-bottom: 10px;
    }
    li {
      margin-bottom: 4px;
    }
    @page { margin: 0.75in; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="company-name">SafeSpace Global</div>
        <div class="company-tagline">Biweekly Business Summary &nbsp;·&nbsp; ${escHtml(period)}</div>
      </div>
      <div class="report-meta">
        Reporting Period: ${escHtml(period)}<br>
        Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
    <div class="confidential">Confidential – Internal Use Only. This report may contain material nonpublic information. Do not distribute or trade on this information.</div>
  </div>
  ${bodyHtml}
</body>
</html>`
}

export default function GeneratePage() {
  const [period, setPeriod] = useState('')
  const [type, setType] = useState<'weekly' | 'biweekly'>('biweekly')
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [allCycles, setAllCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/submissions').then(r => r.json()),
      fetch('/api/cycles').then(r => r.json()),
    ]).then(([subData, cycleData]) => {
      const cycles: Cycle[] = cycleData.cycles ?? []
      setAllCycles(cycles)
      if (subData.cycle) {
        setCycle(subData.cycle)
        setPeriod(subData.cycle.label)
        setType(subData.cycle.type)
        setSelectedCycleId(subData.cycle.id)
      } else if (cycles.length > 0) {
        const latest = cycles[0]
        setPeriod(latest.label)
        setType(latest.type)
        setSelectedCycleId(latest.id)
      }
    }).catch(() => {})
  }, [])

  function handleCycleSelect(cycleId: number) {
    const c = allCycles.find(c => c.id === cycleId)
    if (c) {
      setSelectedCycleId(c.id)
      setPeriod(c.label)
      setType(c.type)
      setContent('')
      setSaved(false)
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildPrintHtml(period, content))
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const selectedCycle = allCycles.find(c => c.id === selectedCycleId)

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Generate report</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="card p-4 space-y-4">

            {/* Cycle selector */}
            {allCycles.length > 1 && (
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
              {content && !saved && (
                <p className="text-xs text-amber-600 text-center">Not yet saved to archive</p>
              )}
            </div>
          )}
        </div>

        {/* Editor / preview */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
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
