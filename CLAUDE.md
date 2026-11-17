# CLAUDE.md — SSGC Board Report

Context for Claude Code sessions working in this repo. Keep it accurate; update it when the architecture changes.

## What this is

A web app that runs SafeSpace Global's biweekly board reporting end to end. Leadership team members submit a structured update on the home page (no login). An hourly Vercel cron opens and closes two-week cycles and posts a reminder sequence to Slack. An admin generates the board report with Claude, edits it (drafts autosave server-side), downloads PDFs, and saves it to the archive once the CEO/President approve it.

## Stack

Next.js 15 (App Router; 15.5.x installed) · React 19 · TypeScript · Tailwind · Neon Postgres (`@neondatabase/serverless`, HTTP driver) · Anthropic SDK (`claude-sonnet-4-6`) · Slack Web API (`@slack/web-api`) · iron-session · `date-fns` / `date-fns-tz`. Deployed on Vercel with an hourly cron (`vercel.json`). No object storage — the only static asset is `public/logo.png`.

## Run and deploy

```bash
npm install
cp .env.local.example .env.local   # fill in values
npm run dev                          # http://localhost:3000
```

- **Local database:** the Neon HTTP driver needs a real Neon connection string (it can't talk to a plain local Postgres). Use a throwaway Neon branch — never production.
- **First run on an empty database:** log in at `/admin`, then `POST /api/init` once (admin-only — e.g. `fetch('/api/init', { method: 'POST' })` from the browser console while logged in). It runs `initDb` in `src/lib/db.ts`. There are no migration files — schema is `CREATE TABLE IF NOT EXISTS` in `initDb`. The old Settings "Initialize database" button was removed.
- **Deploy:** push to `main` → Vercel builds and deploys to production. There is no staging environment.
- **Cron:** `vercel.json` calls `GET /api/cron` hourly (`0 * * * *`; hourly schedules need Vercel Pro). The route requires `Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically when `CRON_SECRET` is set. To run it locally: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron`.
- Scripts: `dev`, `build`, `start`, `lint`. `db:migrate` points at `scripts/migrate.js`, which does not exist. No ESLint config is committed (`next lint` will prompt to create one). No test suite exists.

## Environment variables

Names only — never commit values. See `.env.local.example`.

| Var | Purpose |
| --- | --- |
| `POSTGRES_URL` | Neon connection string (`DATABASE_URL` is accepted as a fallback) |
| `ANTHROPIC_API_KEY` | Claude API — report generation and the Draft Assistant |
| `SLACK_BOT_TOKEN` | Bot token for the Slack app "Board Reports" |
| `SLACK_CHANNEL_ID` | Channel the reminders post to (falls back to `#reports`) |
| `SESSION_SECRET` | 32+ char secret for the iron-session admin cookie |
| `ADMIN_PASSWORD` | Admin login password (single shared secret) |
| `CRON_SECRET` | Bearer token Vercel cron sends to `/api/cron` |
| `NEXT_PUBLIC_APP_URL` | Fallback submission link in Slack messages (the `submission_url` setting wins) |

`.env.local.example` also lists `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` (left over from the Vercel Postgres template). The code does not read them.

## Data model

`cycles` → `submissions`, `reports`, `slack_messages`, plus a key/value `settings` table. Full schema: `initDb` in `src/lib/db.ts`.

- `cycles.is_current` marks the active cycle; `createCycle` unsets the others.
- `submissions` has `UNIQUE(cycle_id, person_name)`; writes go through `upsertSubmission` (`src/lib/cycles.ts`). `headline`, `progress`, `risks` are `NOT NULL`.
- `reports`: one per cycle **enforced in code, not the DB** — there is no unique constraint on `cycle_id`, so `POST /api/reports` does UPDATE-then-INSERT. `cycle_id = NULL` means a manually uploaded historical report.
- `slack_messages` logs each sent (or cancelled) message type per cycle; it is what makes every reminder send at most once.
- `settings` keys: `submission_url`, `cycle_label`, `team_members` (newline-separated full names; overrides the default `TEAM_MEMBERS` in `src/lib/team.ts`), `slack_msg_<type>` (custom Slack templates), `report_draft_<cycleId>` (unsaved report drafts — confidential; excluded from `getAllSettings` and served only by the admin-only `/api/drafts`).
- The team roster is **not versioned per cycle**: `getSubmissionStatus` always uses the current roster. Admin views use `mergeRoster` to keep past submitters who have since been removed.

## Auth

- **Admin** (`/admin/*`): iron-session cookie `safespace_admin`, gated by `ADMIN_PASSWORD`. `requireAdmin()` in `src/lib/auth.ts` also renews the cookie, so the 14-day session is rolling. `src/app/admin/layout.tsx` only gates the UI client-side — real enforcement is per API route.
- **Admin-only APIs:** `reports` (all methods), `admin/settings`, `admin/submissions`, `drafts`, `generate`, `slack`, `cycles` POST/DELETE, `init`. `GET /api/submissions` returns full submission text to admins only; everyone else gets the cycle and statuses (who has submitted).
- **Public by decision (no team login):** home page, `POST /api/submissions`, `/api/submissions/current` and `/previous` (load a person's entry by name), `/api/draft` (Draft Assistant — calls Claude), `GET /api/cycles`, `GET /api/team`. `/archive` redirects to `/admin/archive`.
- **Cron:** `CRON_SECRET` bearer token.

## Cycles and Slack reminders

- **Schedule** (`src/lib/auto-schedule.ts`): every 14 days from Monday June 1, 2026 — opens Mon 8:00 am CT, closes Wed 9:00 am CT, DST-aware. The label is the 14 days ending the Friday before opening (e.g. opens Sep 21 → "Sep 5 – 18").
- **`/api/cron`** (hourly): on a scheduled Monday it creates the cycle if none is current. During the opening week it posts `opening` (Mon 8), `reminder_1` (Mon 16), `reminder_2` (Tue 11), `reminder_3` (Tue 16), `final_warning` (Wed 7), `last_call` (Wed 8), `closed` (Wed 9), all CT. Once everyone has submitted it cancels the rest and posts `celebration`. It auto-closes an expired cycle on every path, so the next one can be created.
- Every message is rendered through `renderMessage` / `resolveTemplate` (`src/lib/slack-templates.ts`), so custom templates apply to the cron and to manual "Send now" alike. Names use `displayName` (first name, or "Michael H." when first names collide).

## Report generation and drafts

- `generateReport` (`src/lib/anthropic.ts`): one Claude call, `max_tokens` 16000, returns `{ content, truncated }`. `/api/generate` sets `maxDuration = 300` — a full report can take 1–2+ minutes. The client parses the response defensively because a Vercel timeout returns non-JSON.
- **Drafts:** the Generate page autosaves to `/api/drafts` about 1s after typing stops, immediately after generation, before switching cycles, and with a keepalive request on page exit. "Save to archive" deletes the draft. Drafts left in browser `localStorage` by older versions are moved to the server on first open.
- **Edit on behalf:** `POST /api/admin/submissions` upserts any roster member's submission for any cycle, ignoring the deadline. It is surfaced as Edit/Add buttons on the Generate page (`AdminSubmissionEditor`).

## PDFs

`src/lib/report-html.ts` builds print-ready HTML that the browser saves as PDF (no PDF library): `buildPrintHtml` for the board report, `buildSubmissionsPrintHtml` for all individual submissions (cover page, then one page per person, alphabetical). `printInNewWindow` opens the window synchronously inside the click so popup blockers allow it.

## Key files

- `src/app/` — `page.tsx` (team submission page), `admin/` (dashboard, generate, archive, submissions, reminders, settings, login), `api/` (see Auth).
- `src/lib/` — `db.ts` (schema, lazy Neon client, query shim, settings helpers), `cycles.ts` (cycle + submission queries, statuses), `auto-schedule.ts` (schedule math), `slack.ts` / `slack-templates.ts` (posting, dedupe, templates), `anthropic.ts` (prompts + Claude calls), `auth.ts`, `team.ts` (default roster + pure helpers) / `team-store.ts` (effective roster from settings, server-only), `report-html.ts` (PDF HTML).
- `src/components/` — `SubmissionForm`, `DraftAssistant`, `Scoreboard`, `PreviousSubmission`, `SaveCopyPanel`, `AdminSubmissionEditor`, `Nav`.
- `src/types/index.ts` — shared types.

## Gotchas

- **This repo is public.** `SESSION_SECRET` and `ADMIN_PASSWORD` fall back to hard-coded literals in `src/lib/auth.ts` when unset — anyone could read them on GitHub. They must be set in Vercel; prefer making the code fail closed.
- Keep the Neon client lazy (`getSql()` in `db.ts`). Constructing it at module load throws when `POSTGRES_URL` is unset and breaks `next build`.
- `next build` rewrites `tsconfig.json` (adds `"target": "ES2017"`, reformats). The committed file has no `target`, so plain `npx tsc --noEmit` uses an old default where function declarations inside blocks fail — use arrow functions there. Revert the rewrite (`git checkout tsconfig.json`) unless you mean to commit it.
- Never use `ON CONFLICT (cycle_id)` on `reports` — there's no matching constraint, and Postgres rejects the write.
- `team.ts` must stay client-safe (no DB imports); server code reads the roster via `team-store.ts`.
- All schedule logic is Central Time; Vercel cron runs in UTC.
- `README.md` is outdated (Next.js 14, Vercel Postgres, the removed Initialize button, old reminder times, roster in `team.ts`). Trust this file.
- Pushing to `main` deploys to production immediately, possibly while a report is under review. Drafts are server-side, so a deploy doesn't lose them.
- `ssgc-resident-intake` and this repo share the same Vercel/Neon accounts but are otherwise independent (own repo, own project, own database).
