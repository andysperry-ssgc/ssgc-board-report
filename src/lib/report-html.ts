/**
 * Shared PDF rendering helpers used by both the dashboard generate panel
 * and the archive page. Drop public/logo.png into the project and it will
 * automatically appear in every printed report.
 */

import type { Submission, SubmissionStatus } from '@/types'

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderInline(text: string): string {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
}

// Convert plain-text report (markdown-style) → clean HTML for printing
export function reportToHtml(text: string): string {
  const lines = text.split('\n')
  let html = ''
  let inBulletList = false

  const closeBulletList = () => {
    if (inBulletList) { html += '</ul>'; inBulletList = false }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Close bullet list when we hit a non-bullet non-empty line
    if (inBulletList && trimmed !== '' && !/^[•\-*]\s/.test(trimmed)) {
      closeBulletList()
    }

    // --- horizontal rule → skip (we use h2 border-bottom instead)
    if (/^---+$/.test(trimmed)) continue

    // # h1 → skip (report title already in header)
    if (/^#\s/.test(trimmed)) continue

    // ## h2 → section heading
    if (/^##\s/.test(trimmed)) {
      closeBulletList()
      html += `<h2>${escHtml(trimmed.replace(/^##\s+/, ''))}</h2>`
      continue
    }

    // ### h3 → sub-heading
    if (/^###\s/.test(trimmed)) {
      closeBulletList()
      html += `<h3>${escHtml(trimmed.replace(/^###\s+/, ''))}</h3>`
      continue
    }

    // **text** as standalone line → h2 (legacy format)
    if (/^\*\*(.+)\*\*$/.test(trimmed)) {
      closeBulletList()
      html += `<h2>${escHtml(trimmed.replace(/^\*\*/, '').replace(/\*\*$/, ''))}</h2>`
      continue
    }

    // *text* as standalone line → h3 (legacy format)
    if (/^\*([^*]+)\*$/.test(trimmed)) {
      closeBulletList()
      html += `<h3>${escHtml(trimmed.replace(/^\*/, '').replace(/\*$/, ''))}</h3>`
      continue
    }

    // Bullet lines: •, -, or * followed by space
    if (/^[•\-*]\s/.test(trimmed)) {
      if (!inBulletList) { html += '<ul>'; inBulletList = true }
      const item = trimmed.replace(/^[•\-*]\s/, '')
      html += `<li>${renderInline(item)}</li>`
      continue
    }

    // Numbered list: "1. text"
    if (/^\d+\.\s/.test(trimmed)) {
      if (inBulletList) closeBulletList()
      const item = trimmed.replace(/^\d+\.\s/, '')
      html += `<p style="margin-left:1.2em;text-indent:-1.2em">${renderInline(trimmed.match(/^(\d+\.)/)?.[1] ?? '')} ${renderInline(item)}</p>`
      continue
    }

    if (trimmed === '') continue

    html += `<p>${renderInline(line)}</p>`
  }

  closeBulletList()
  return html
}

/**
 * Fetch /logo.png and return as a base64 data URL so it can be embedded
 * in a print window that has no origin. Returns null if file doesn't exist.
 * Place your logo at public/logo.png (PNG, SVG, or JPEG — any format works).
 */
export async function fetchLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function buildPrintHtml(
  period: string,
  content: string,
  logoDataUrl?: string | null,
): string {
  const bodyHtml = reportToHtml(content)

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="SafeSpace Global" style="height: 40px; width: auto; display: block;" />`
    : `<div class="company-name">SafeSpace Global</div>`

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
      margin-top: 4px;
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
    ul { padding-left: 18px; margin-bottom: 10px; }
    li { margin-bottom: 4px; }
    @page { margin: 0.75in; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        ${logoHtml}
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

/**
 * Open a print window immediately (while still inside the click, so popup
 * blockers allow it), then fill it once the async HTML is ready and print.
 */
export async function printInNewWindow(build: () => Promise<string>): Promise<void> {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write('<p style="font-family:sans-serif;padding:24px;color:#555">Preparing PDF…</p>')
  try {
    const html = await build()
    win.document.open()
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 600)
  } catch {
    win.document.body.innerHTML =
      '<p style="font-family:sans-serif;padding:24px;color:#b91c1c">Could not build the PDF. Close this tab and try again.</p>'
  }
}

const SUBMISSION_FIELDS: { key: keyof Submission; label: string }[] = [
  { key: 'headline', label: 'Headline' },
  { key: 'progress', label: 'Progress / wins' },
  { key: 'risks', label: 'Risks / issues' },
  { key: 'metrics', label: 'Key metrics' },
  { key: 'board_update', label: 'Board-relevant update' },
  { key: 'focus', label: 'Focus last period' },
  { key: 'priorities', label: 'Next period priorities' },
]

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * Every individual submission for a cycle, in one printable document: a cover
 * page (who submitted, who didn't) followed by one page per submitter,
 * alphabetical by name. Pure formatting of what was submitted — no AI.
 */
export function buildSubmissionsPrintHtml(
  period: string,
  submissions: Submission[],
  statuses: SubmissionStatus[],
  logoDataUrl?: string | null,
): string {
  const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })
  const subs = [...submissions].sort((a, b) => byName(a.person_name, b.person_name))
  const submittedNames = new Set(subs.map((s) => s.person_name))
  const missing = statuses.map((s) => s.name).filter((n) => !submittedNames.has(n)).sort(byName)
  const total = subs.length + missing.length

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="SafeSpace Global" style="height: 40px; width: auto; display: block;" />`
    : `<div class="company-name">SafeSpace Global</div>`

  const submittedList = subs.length
    ? `<ul>${subs.map((s) => `<li>${escHtml(s.person_name)} <span class="muted">— ${shortDate(s.submitted_at)}</span></li>`).join('')}</ul>`
    : `<p class="muted">No submissions.</p>`

  const missingList = missing.length
    ? `<ul>${missing.map((n) => `<li>${escHtml(n)}</li>`).join('')}</ul>`
    : `<p class="muted">Everyone submitted.</p>`

  const personPages = subs.map((s) => {
    const updated = shortDate(s.updated_at) !== shortDate(s.submitted_at)
      ? ` &nbsp;·&nbsp; Updated ${shortDate(s.updated_at)}`
      : ''
    const fields = SUBMISSION_FIELDS
      .filter(({ key }) => (s[key] as string | null)?.toString().trim())
      .map(({ key, label }) => `<h3>${label}</h3><div class="field">${escHtml(String(s[key]).trim())}</div>`)
      .join('')
    return `<section class="person">
    <div class="running">${escHtml(period)} &nbsp;·&nbsp; Individual submissions</div>
    <h2>${escHtml(s.person_name)}</h2>
    <p class="muted">Submitted ${shortDate(s.submitted_at)}${updated}</p>
    ${fields}
  </section>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escHtml(period)} — Individual Submissions</title>
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
    .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 18pt; font-weight: 700; letter-spacing: -0.5px; color: #111; }
    .company-tagline { font-size: 8.5pt; color: #666; margin-top: 4px; }
    .report-meta { text-align: right; font-size: 8.5pt; color: #555; line-height: 1.5; }
    .confidential {
      font-size: 8pt; color: #888; font-style: italic;
      margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px;
    }
    h1 { font-size: 16pt; font-weight: 700; margin-bottom: 4px; }
    h2 {
      font-size: 13pt; font-weight: 700; color: #111;
      margin-bottom: 2px; padding-bottom: 4px; border-bottom: 1px solid #ddd;
    }
    h3 {
      font-size: 9pt; font-weight: 600; color: #555; text-transform: uppercase;
      letter-spacing: 0.5px; margin-top: 14px; margin-bottom: 4px;
    }
    .cover-section h3 { margin-top: 20px; }
    .field { white-space: pre-wrap; }
    .muted { color: #777; font-size: 9pt; }
    .running { font-size: 8pt; color: #999; margin-bottom: 10px; }
    p { margin-bottom: 8px; }
    ul { padding-left: 18px; margin-bottom: 10px; }
    li { margin-bottom: 3px; }
    .person { break-before: page; page-break-before: always; }
    @page { margin: 0.75in; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        ${logoHtml}
        <div class="company-tagline">Individual Submissions &nbsp;·&nbsp; ${escHtml(period)}</div>
      </div>
      <div class="report-meta">
        Reporting Period: ${escHtml(period)}<br>
        Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
    <div class="confidential">Confidential – Internal Use Only. This report may contain material nonpublic information. Do not distribute or trade on this information.</div>
  </div>
  <div class="cover-section">
    <h1>Individual Submissions</h1>
    <p class="muted">${subs.length} of ${total} submitted &nbsp;·&nbsp; one page per person, alphabetical</p>
    <h3>Submitted</h3>
    ${submittedList}
    <h3>No submission</h3>
    ${missingList}
  </div>
  ${personPages}
</body>
</html>`
}
