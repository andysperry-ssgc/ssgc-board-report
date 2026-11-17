# Onboarding — SSGC Board Report

You've just inherited this project. This is the human orientation; `CLAUDE.md` has the technical detail (and is what a Claude Code session reads automatically). Read both.

## What it does

Runs SafeSpace Global's biweekly board report. Every other Monday a new reporting cycle opens and a Slack bot announces it. Each leadership team member submits a short structured update (headline, progress, risks, plus optional metrics, board items, focus and priorities) on the app's home page, optionally pasting notes into an AI "Draft Assistant" that fills the fields for them. The bot posts reminders through Wednesday 9:00 am CT showing who's in and who isn't. An admin then has Claude synthesize every update into one executive board report, edits it, sends the PDF to the CEO and President for review, and saves the approved version to the archive.

## How it's built and run

- **Stack:** Next.js 15 (App Router) / React / TypeScript / Tailwind, Neon Postgres, Anthropic Claude API, Slack API, iron-session. Deployed on Vercel with an hourly cron job that drives the cycle schedule and Slack reminders.
- **Deploy:** push to `main` → Vercel auto-deploys to production. No staging.
- **First-time DB setup:** log in at `/admin`, then send `POST /api/init` once to create the tables.
- **Local dev:** `npm install`, copy `.env.local.example` to `.env.local`, fill values (use a throwaway Neon branch, not production), `npm run dev`.
- Full details, env vars, data model, and gotchas: see `CLAUDE.md`. The README is out of date.

## Accounts and access

This app spans several third-party accounts (GitHub, Vercel, Neon, Anthropic, Slack). The full inventory, who owns what, and the step-by-step ownership transfer are tracked in the **SSGC Tools Handoff checklist** (shared separately). Start there for anything about access, billing, or moving ownership. Do not put secret values in this file or any shared doc — rotate them instead.

At a glance for this app:
- **Code:** GitHub repo `ssgc-board-report` (**public**).
- **Hosting:** Vercel project `ssgc-board-report` (`ssgc-board-report.vercel.app`), including the hourly cron (requires a Pro plan).
- **Database:** Neon project `neon-citron-helmet` (auto-generated name; may be renamed to `ssgc-board-report-db`). The code uses no object storage; if any storage resource exists in the account, this app doesn't reference it.
- **AI:** `ANTHROPIC_API_KEY` from the company Anthropic organization (owner listed in the handoff checklist).
- **Slack:** app "Board Reports" in the SafeSpace Global workspace, via `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` (bot scopes `chat:write`, `chat:write.public`).
- **Admin login:** single shared password in `ADMIN_PASSWORD`.

## How people use it

- **Leadership team** (home page, no login): pick your name, submit or edit your update until the Wednesday deadline. Last cycle's entry is shown for reference; the scoreboard shows who has submitted.
- **Admins** (`/admin`, password-protected):
  - Dashboard: the current cycle at a glance.
  - Generate: create the report with Claude, edit it, add or correct anyone's input on their behalf (even after the deadline), and download PDFs of the report or of all individual submissions. Drafts autosave and can be resumed from any device.
  - Archive: past cycles and approved reports.
  - Reminders: preview, edit, and manually send the Slack messages.
  - Settings: team roster, submission link, and the upcoming cycle schedule.
- **Slack** (automatic): the opening message, three reminders, final warning, last call, and closed message each post once per cycle. If everyone submits early, a celebration replaces the remaining reminders.

## Known issues to address (not blocking day-to-day use)

- **Public repo with hard-coded fallbacks.** If `SESSION_SECRET` or `ADMIN_PASSWORD` is ever missing in Vercel, the app falls back to defaults visible on GitHub, which would allow admin access. Confirm both are set to strong values, and either make the repo private or make the code refuse to start without them. (Highest priority.)
- **The team site has no login** (a deliberate trade-off for participation). Anyone with the link can load or overwrite a person's current entry by picking their name, or run the Draft Assistant, which spends Anthropic credits. A shared team passcode would close this.
- **Admin auth is one shared password** — no per-user accounts or audit trail.
- **No automated tests.** Verification is manual.
- **The team roster isn't recorded per cycle**, so a past cycle's "didn't submit" list reflects today's roster.
- **Database is initialized by `POST /api/init`** rather than real migrations; the `db:migrate` npm script is broken and the README is outdated.

## First things to do

1. Confirm you have access to the GitHub repo, the Vercel project, the Neon database, the Anthropic organization, and the Slack app (see the handoff checklist).
2. In Vercel, confirm `SESSION_SECRET` and `ADMIN_PASSWORD` are set to strong values.
3. Pull the repo, `npm install`, create `.env.local`, and run it locally against a throwaway Neon branch.
4. Rotate the secrets you inherited (`SESSION_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, Neon password) once you're set up. Rotating `SESSION_SECRET` signs every admin out.
5. Check where the current cycle is before deploying — pushes to `main` go straight to production, possibly while a report is under review.
6. Read `CLAUDE.md` so a Claude Code session in this repo starts with full context.
