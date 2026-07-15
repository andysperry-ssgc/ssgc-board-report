'use client'

import { useState, useEffect } from 'react'
import { getUpcomingCycleDates, buildAutoLabel, getCloseTime } from '@/lib/auto-schedule'
import { serializeTeamList } from '@/lib/team'
import type { TeamMember } from '@/types'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [submissionUrl, setSubmissionUrl] = useState('')
  const [cycleLabel, setCycleLabel] = useState('')
  const [team, setTeam] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings').then((r) => r.json()),
      fetch('/api/team').then((r) => r.json()),
    ])
      .then(([settingsData, teamData]) => {
        const s = settingsData.settings ?? {}
        setSubmissionUrl(s.submission_url ?? '')
        setCycleLabel(s.cycle_label ?? '')
        setTeam((teamData.members ?? []).map((m: TeamMember) => m.name))
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

  function updateMember(index: number, value: string) {
    setTeam((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  function removeMember(index: number) {
    setTeam((prev) => prev.filter((_, i) => i !== index))
  }

  function addMember() {
    setTeam((prev) => [...prev, ''])
  }

  async function saveTeam() {
    const cleaned = team.map((n) => n.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      setError('The team needs at least one person.')
      return
    }
    await saveSetting('team_members', serializeTeamList(cleaned.map((name) => ({ name }))), 'Team')
    setTeam(cleaned)
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

        {/* Admin password */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Admin password</h2>
          <p className="text-xs text-gray-500">
            The admin password is set via the <code className="bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code> environment
            variable in Vercel. To change it, update that variable in your Vercel project settings and redeploy.
          </p>
        </div>

        {/* Team members */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Team members</h2>
          <p className="text-xs text-gray-500">
            Who appears on the submission form, scoreboard, and reminders. Enter each person&apos;s full name.
            Removing someone takes them off the roster going forward — their past submissions are kept.
          </p>
          <div className="space-y-2">
            {team.map((name, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  value={name}
                  placeholder="Full name"
                  onChange={(e) => updateMember(i, e.target.value)}
                />
                <button
                  onClick={() => removeMember(i)}
                  className="btn-ghost text-sm text-red-500 hover:text-red-700 px-3"
                  aria-label={`Remove ${name || 'member'}`}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={addMember} className="btn-ghost text-sm">+ Add person</button>
            <button
              onClick={saveTeam}
              disabled={saving === 'team_members'}
              className="btn-primary text-sm ml-auto"
            >
              {saving === 'team_members' ? 'Saving…' : 'Save team'}
            </button>
          </div>
        </div>

        {/* Auto-scheduling */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Auto-scheduling</h2>
          <p className="text-xs text-gray-500">
            Cycles are created automatically every other Monday starting June 1, 2026.
            The cron job runs hourly — at 8am CT on each scheduled Monday it will open a new cycle
            if none is active, then immediately post the opening Slack message.
            Submissions close Wednesday at 9:00 am CT.
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
      </div>
    </div>
  )
}
