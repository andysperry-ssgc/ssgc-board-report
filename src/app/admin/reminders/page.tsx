'use client'

import { useState, useEffect } from 'react'
import type { SlackMessageType } from '@/types'
import { DEFAULT_TEMPLATES } from '@/lib/slack-templates'

interface MessagePreview {
  type: SlackMessageType
  text: string
  template: string
  isCustom: boolean
  sent: boolean
}

const MESSAGE_LABELS: Record<SlackMessageType, string> = {
  opening:       'Mon 8:00 am — Cycle opens',
  reminder_1:    'Mon 4:00 pm — First reminder',
  reminder_2:    'Tue 11:00 am — Second reminder',
  reminder_3:    'Tue 4:00 pm — Third reminder',
  final_warning: 'Wed 7:00 am — Final warning',
  last_call:     'Wed 8:00 am — Last call',
  celebration:   'Early close — Celebration',
  closed:        'Wed 9:00 am — Submissions closed',
}

const TEMPLATE_VARS = [
  { key: '{{cycleLabel}}',    desc: 'Cycle period label, e.g. "May 16 – 29"' },
  { key: '{{submissionUrl}}', desc: 'Link to the submission page' },
  { key: '{{teamNames}}',     desc: 'First names separated by spaces (opening only)' },
  { key: '{{submittedList}}', desc: '✅ Name  ✅ Name — who has submitted' },
  { key: '{{pendingList}}',   desc: '⏳ Name  ⏳ Name — who is pending' },
  { key: '{{pendingNames}}',  desc: 'Comma-separated full names still needed' },
]

export default function RemindersPage() {
  const [previews, setPreviews] = useState<MessagePreview[]>([])
  const [cycle, setCycle] = useState<{ label: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Which message is expanded (preview) or in edit mode
  const [expanded, setExpanded] = useState<SlackMessageType | null>(null)
  const [editing, setEditing] = useState<SlackMessageType | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const [sending, setSending] = useState<SlackMessageType | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/slack')
      const data = await res.json()
      setPreviews(data.previews ?? [])
      setCycle(data.cycle)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(type: SlackMessageType) {
    setSending(type)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_type: type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setSuccess(`Sent: ${MESSAGE_LABELS[type]}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(null)
    }
  }

  function startEdit(preview: MessagePreview) {
    setEditing(preview.type)
    setEditDraft(preview.template)
    setExpanded(null)
  }

  async function handleSaveTemplate(type: SlackMessageType) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `slack_msg_${type}`, value: editDraft }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSuccess('Template saved.')
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetTemplate(type: SlackMessageType) {
    setSaving(true)
    setError('')
    try {
      await fetch(`/api/admin/settings?key=slack_msg_${type}`, { method: 'DELETE' })
      setSuccess('Reset to default.')
      setEditing(null)
      await load()
    } catch {
      setError('Reset failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reminders</h1>
          {cycle && <p className="text-sm text-gray-500 mt-0.5">{cycle.label}</p>}
        </div>
        <button onClick={load} className="btn-ghost text-sm">Refresh</button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{success}</div>
      )}

      <div className="mb-4 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        <strong>Automated schedule:</strong> Messages fire automatically via cron when the cycle is active (all times CT). Use manual send for off-schedule needs or testing.
      </div>

      {!cycle && !loading && (
        <div className="mb-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2">
          No active cycle — templates are editable but send buttons are disabled until a cycle opens.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-2">
          {previews.map((preview) => (
            <div key={preview.type} className="card overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${preview.sent ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {MESSAGE_LABELS[preview.type]}
                  </span>
                  {preview.sent && (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 flex-shrink-0">
                      Sent
                    </span>
                  )}
                  {preview.isCustom && !preview.sent && (
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 flex-shrink-0">
                      Customized
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (editing === preview.type) { setEditing(null) }
                      else setExpanded(expanded === preview.type ? null : preview.type)
                    }}
                    className="btn-ghost text-xs"
                  >
                    {expanded === preview.type ? 'Hide' : 'Preview'}
                  </button>
                  <button
                    onClick={() => editing === preview.type ? setEditing(null) : startEdit(preview)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      editing === preview.type
                        ? 'bg-gray-100 text-gray-600'
                        : 'btn-ghost'
                    }`}
                  >
                    {editing === preview.type ? 'Cancel' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleSend(preview.type)}
                    disabled={sending === preview.type || !cycle}
                    className="btn-secondary text-xs"
                    title={!cycle ? 'No active cycle' : undefined}
                  >
                    {sending === preview.type ? 'Sending…' : 'Send now'}
                  </button>
                </div>
              </div>

              {/* Preview panel */}
              {expanded === preview.type && editing !== preview.type && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {preview.text}
                  </pre>
                </div>
              )}

              {/* Edit panel */}
              {editing === preview.type && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                      Message template
                    </label>
                    <textarea
                      className="textarea font-mono text-xs min-h-[160px]"
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                    />
                  </div>

                  {/* Variable reference */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-600 select-none">
                      Available variables
                    </summary>
                    <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-200">
                      {TEMPLATE_VARS.map(v => (
                        <div key={v.key} className="flex gap-2">
                          <code className="text-brand-600 flex-shrink-0">{v.key}</code>
                          <span className="text-gray-500">{v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </details>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleSaveTemplate(preview.type)}
                      disabled={saving}
                      className="btn-primary text-xs"
                    >
                      {saving ? 'Saving…' : 'Save template'}
                    </button>
                    <button
                      onClick={() => setEditDraft(DEFAULT_TEMPLATES[preview.type])}
                      className="btn-ghost text-xs"
                    >
                      Reset to default
                    </button>
                    {preview.isCustom && (
                      <button
                        onClick={() => handleResetTemplate(preview.type)}
                        disabled={saving}
                        className="btn-ghost text-xs text-red-500 hover:text-red-700"
                      >
                        Remove custom template
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
