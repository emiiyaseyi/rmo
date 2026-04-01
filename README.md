# DSN Resource Management Office (RMO)

Internal HR and timesheet management platform for Data Science Nigeria.

## Stack

- **Frontend/Backend**: Next.js 15 (App Router)
- **Database**: PostgreSQL 18 (local) / Azure PostgreSQL Flexible Server (production)
- **Auth**: Custom session-based auth with bcrypt passwords
- **Email**: Resend + React Email
- **Deployment**: Netlify (frontend + serverless API) + Azure PostgreSQL

## Features

- Timesheet submission with configurable weekly windows and late penalties
- Multi-level approval workflow (lead → 2nd-level admin for high-value or out-of-window entries)
- Review window enforcement — leads are emailed when submission closes and penalised for late reviews
- Leave requests and approvals
- Staff management, organogram, and delegation support
- Points, streaks, badges, leaderboard, and rewards system
- Analytics: weekly/monthly reports, department breakdowns, utilisation
- Announcements, public holidays, bulk imports
- Admin: audit trail, password reset queue, forced logout, week locking

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Requires a `.env` file:
```
DATABASE_URL=postgresql://database:password@host:5432/database
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Apply schema to local PostgreSQL:
```bash
psql $DATABASE_URL -f src/db/schema.sql
```

## Database Migration (Firestore → PostgreSQL)

```bash
# All essential tables (staff, projects, settings, leaves, etc.)
npx tsx scripts/migrate-firestore-to-pg.ts

# Timesheet entries only
npx tsx scripts/migrate-timesheet-entries.ts
```

Both scripts require `scripts/service-account.json` (Firebase service account key — gitignored).

## Production

- **App**: [rmo.dsnsandbox.com](https://rmo.dsnsandbox.com) via Netlify
- **Database**: PostgreSQL 18
- Set `DATABASE_URL` in Netlify environment variables pointing to Azure

Deploy by pushing to `main` — Netlify auto-deploys.
