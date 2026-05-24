# SafeSpace Global — Board Report System

Internal board report submission and generation system. Built with Next.js 14, Vercel Postgres, Anthropic API, and Slack.

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Create a Vercel Postgres database

In the Vercel dashboard: Storage → Create → Postgres. Copy the environment variables into `.env.local`.

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
ANTHROPIC_API_KEY=        # Your Anthropic API key
SLACK_BOT_TOKEN=          # Bot token from your Slack app (xoxb-...)
SLACK_CHANNEL_ID=         # Channel ID for #reports
SESSION_SECRET=           # Random 32+ char string
ADMIN_PASSWORD=           # Admin login password (default: admin123)
NEXT_PUBLIC_APP_URL=      # Your deployed app URL (for Slack links)
CRON_SECRET=              # Random string to authenticate cron requests
```

### 4. Run locally

```bash
npm run dev
```

### 5. Initialize database

Visit `/admin/settings` after logging in, and click **Initialize database**.

---

## Deployment (Vercel)

1. Push to GitHub and import project in Vercel
2. Add all env vars in Vercel dashboard → Settings → Environment Variables
3. Vercel automatically reads `vercel.json` and schedules the hourly cron job
4. After first deploy: log into `/admin/settings` and click **Initialize database**
5. Open your first cycle in `/admin/dashboard` → **+ New cycle**

---

## Slack app setup

1. Create a Slack app at api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `chat:write.public`
3. Install to your workspace
4. Copy Bot OAuth Token to `SLACK_BOT_TOKEN`
5. Copy the channel ID (right-click channel → View channel details) to `SLACK_CHANNEL_ID`

---

## How it works

### Submission cycle

- Admin opens a new cycle (Dashboard → + New cycle) with a label, type, open date, and close date
- Team members visit the app, pick their name, and submit their update
- Scoreboard updates live showing who has submitted

### Slack reminders (automated)

The cron job runs hourly and posts to `#reports` based on the cycle schedule:

| Time (CT)     | Message                        |
|---------------|--------------------------------|
| Mon 8:00 am   | Cycle open announcement        |
| Mon 4:00 pm   | First reminder                 |
| Tue 11:00 am  | Second reminder                |
| Tue 4:00 pm   | Third reminder                 |
| Wed 8:00 am   | Final warning                  |
| Wed 2:00 pm   | Last call                      |
| Wed 5:00 pm   | Report distributed             |

If all submissions come in early, the celebration message fires and remaining reminders are cancelled.

### Report generation

Admin → Generate tab → enter period → Generate. Claude synthesizes all submissions into a structured board report. Edit inline, then Download PDF (browser print) or Save to archive.

---

## Team member list

Configured in `src/lib/team.ts`. Edit the `TEAM_MEMBERS` array to add/remove people.

## Admin password

Set `ADMIN_PASSWORD` env var. Default for local dev: `admin123`.
