# Team Timesheets

A small web app that turns Jira worklogs into a live team timesheet and utilisation dashboard.

> Built during my project management internship at DxDy for the team's own use. This public copy is a cleaned-up version: it contains no company data, no real names or employee records, and no credentials. All sample people are fictional.

**Stack:** Next.js 14 (App Router, TypeScript) · Postgres (Neon/Vercel) · NextAuth (Google sign-in) · Jira REST API · deployed on Vercel.

## What it does
- Pulls worklogs from Jira (on demand, when the data is stale, and on a daily cron) into Postgres.
- Dashboard of hours per person per day, by team, with utilisation = logged ÷ capacity (working days minus public holidays and leave). Sprint, week, month and custom ranges.
- By-project view, per-person page with worklogs, CSV export.
- Role-based access: **admin** (everything, plus edit history and sign-in history), **manager** (roster and leave edits), **viewer** (everyone else on the allowed email domain; can add their own leave).
- Audit log of every change, sign-in history, and a recycle bin for anything deleted.
- Sessions stay signed in while active, sign out after 30 minutes idle or when the site is closed.
- Light/dark theme, responsive phone layout, installable as a home-screen app.

## Run it
1. Create a Postgres database and a Google OAuth client; create a Jira API token.
2. Copy `.env.example` to `.env.local` and fill it in (never commit real values).
3. `npm install`, then `DATABASE_URL=... node scripts/migrate.mjs --seed` to create the tables with a fictional sample roster.
4. `npm run dev`, or deploy to Vercel and add the same variables there.

## Notes
- All names in `db/seed.sql` are fictional. Roster people are linked to Jira accounts from the Roster & Settings page.
- Roles are decided on every request from `ADMIN_EMAILS` / `MANAGER_EMAILS` / `ALLOWED_DOMAIN`.
