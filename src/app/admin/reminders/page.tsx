'use client'

import { useState, useEffect } from 'react'
import type { SlackMessageType } from '@/types'

interface MessagePreview {
  type: SlackMessageType
  text: string
  sent: boolean
}

const MESSAGE_LABELS: Record<SlackMessageType, string> = {
  opening: 'Mon 8:00 am — Cycle opens',
  reminder_1: 'Mon 4:00 pm — First reminder',
  reminder_2: 'Tue 11:00 am — Second reminder',
  reminder_3: 'Tue 4:00 pm — Third reminder',
  final_warning: 'Wed 8:00 am — Final warning',
  last_call: 'Wed 2:00 pm — Last call',
  celebration: 'Early close — Celebration',
  closed: 'Wed 5:00 pm — Report distributed',
}

export default function RemindersPage() {
  const [previews, setPreviews] = useState<MessagePreview[]>([])
  const [expanded, setExpanded] = useState<SlackMessageType | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<SlackMessageType | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cycle, setCycle] = useState<{ label: string } | null>(null)

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
        <strong>Automated schedule:</strong> Messages fire automatically via cron when the cycle is active. Use manual send for off-schedule needs or testing.
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : !cycle ? (
        <div className="card p-6 text-sm text-gray-500 text-center">No active cycle.</div>
      ) : (
        <div className="space-y-2">
          {previews.map((preview) => (
            <div key={preview.type} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      preview.sent ? 'bg-green-400' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {MESSAGE_LABELS[preview.type]}
                  </span>
                  {preview.sent && (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                      Sent
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(expanded === preview.type ? null : preview.type)}
                    className="btn-ghost text-xs"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleSend(preview.type)}
                    disabled={sending === preview.type}
                    className="btn-secondary text-xs"
                  >
                    {sending === preview.type ? 'Sending…' : 'Send now'}
                  </button>
                </div>
              </div>

              {expanded === preview.type && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {preview.text}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
