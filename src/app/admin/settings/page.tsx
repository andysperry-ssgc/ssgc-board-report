'use client'

import { useState, useEffect } from 'react'
import { getUpcomingCycleDates, buildAutoLabel, getCloseTime } from '@/lib/auto-schedule'

interface Settings {
  submission_url?: string
  cycle_label?: string
  team_members?: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [submissionUrl, setSubmissionUrl] = useState('')
  const [cycleLabel, setCycleLabel] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [initLoading, setInitLoading] = useState(false)
  const [initMsg, setInitMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings ?? {}
        setSettings(s)
        setSubmissionUrl(s.submission_url ?? '')
        setCycleLabel(s.cycle_label ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function saveSetting(key: string, value: string, label: string) {
    setSaving(key)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSuccess(`${label} saved.`)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    await saveSetting('admin_password', newPassword, 'Password')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleInitDb() {
    setInitLoading(true)
    setInitMsg('')
    try {
      const res = await fetch('/api/init', { method: 'POST' })
      const data = await res.json()
      setInitMsg(res.ok ? '✓ Database initialized successfully.' : data.error || 'Failed')
    } finally {
      setInitLoading(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{success}</div>
      )}

      <div className="space-y-6 max-w-xl">
        {/* Submission URL */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Submission URL</h2>
          <p className="text-xs text-gray-500">Used in Slack messages. Should be your Vercel app URL.</p>
          <div className="flex gap-2">
            <input
              type="url"
              className="input flex-1"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://yourapp.vercel.app"
            />
            <button
              onClick={() => saveSetting('submission_url', submissionUrl, 'URL')}
              disabled={saving === 'submission_url'}
              className="btn-primary text-sm"
            >
              {saving === 'submission_url' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Default cycle label */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Default cycle label</h2>
          <p className="text-xs text-gray-500">Pre-filled when opening a new cycle.</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              value={cycleLabel}
              onChange={(e) => setCycleLabel(e.target.value)}
              placeholder="Biweekly Update"
            />
            <button
              onClick={() => saveSetting('cycle_label', cycleLabel, 'Cycle label')}
              disabled={saving === 'cycle_label'}
              className="btn-primary text-sm"
            >
              {saving === 'cycle_label' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Password change */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Change admin password</h2>
          <p className="text-xs text-gray-500">
            For a permanent change, also update <code className="bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code> in your Vercel environment variables.
          </p>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input
              type="password"
              className="input"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <input
              type="password"
              className="input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type="submit" disabled={!newPassword || saving === 'admin_password'} className="btn-primary text-sm">
              {saving === 'admin_password' ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Auto-scheduling */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Auto-scheduling</h2>
          <p className="text-xs text-gray-500">
            Cycles are created automatically every other Monday starting June 1, 2026.
            The cron job runs hourly — at 9am CT on each scheduled Monday it will open a new cycle
            if none is active, then immediately post the opening Slack message.
          </p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Upcoming cycles</p>
            {getUpcomingCycleDates(6).map((d) => {
              const close = getCloseTime(d)
              const openStr = d.toLocaleDateString('en-US', {
                timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric',
              })
              const closeStr = close.toLocaleDateString('en-US', {
                timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric',
              })
              return (
                <div key={d.toISOString()} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700 font-medium">{buildAutoLabel(d)}</span>
                  <span className="text-gray-400">{openStr} → {closeStr}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400">To skip a cycle, simply create a new one manually on a different schedule — the auto-create step is skipped whenever a cycle is already active.</p>
        </div>

        {/* Database init */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Database</h2>
          <p className="text-xs text-gray-500">
            Run on first deploy to create all tables. Safe to re-run (uses CREATE IF NOT EXISTS).
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleInitDb}
              disabled={initLoading}
              className="btn-secondary text-sm"
            >
              {initLoading ? 'Initializing…' : 'Initialize database'}
            </button>
            {initMsg && <span className="text-xs text-gray-600">{initMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
