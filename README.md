# DSN Resource Management System

Full-featured timesheet, approval, and staff management system built with React + Vite.

## 🚀 Deploy to Vercel via GitHub

```bash
# 1. Clone / initialize
cd dsn-rms
git init
git add .
git commit -m "feat: DSN RMS initial build"

# 2. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/dsn-rms.git
git push -u origin main

# 3. Go to vercel.com → New Project → Import from GitHub
# Vercel auto-detects Vite. No config needed.
```

## 🔌 Connect Supabase

1. Go to [supabase.com](https://supabase.com) and create a project
2. In Supabase → SQL Editor, paste and run `supabase_schema.sql` (in project root)
3. Log into DSN RMS as admin → Settings → Supabase → paste Project URL + Anon Key
4. Click "Test & Save Connection"

**That's it.** All data will now sync to Supabase in real-time.

## 👤 Adding Your First Admin

After deploying, go to Settings → Staff and add your admin account manually,
OR import via the Excel/CSV bulk import. Set role to `admin`.

## 📁 Staff Import Format

CSV/Excel columns:
| Name | Email | Department | Role | Lead | Phone | PIN |
|------|-------|------------|------|------|-------|-----|
| Jane Doe | jane@dsn.com | Engineering | staff | John Manager | +234... | 1234 |

- `Role`: `staff`, `owner`, or `admin`
- `Lead`: Must match exact name of an existing staff member
- `PIN`: Default PIN (staff change on first login)

## 🔑 Default Login Flow
1. Enter email → enter PIN
2. First login: staff must set a new PIN before accessing the app
3. Forgot PIN: requests go to Settings → PIN Resets queue

## ✨ Feature Summary
- Email + PIN auth with lockout, idle timeout, first-login PIN change
- Timesheet with 45h cap enforcement, submission window, bulk import/export
- Approval workflow: approve / correct / reject / clarify + 2nd-level threshold
- Leaderboard with points, badges, Hall of Fame, Points Shop
- Direct messages + group channels
- Analytics with week comparison, budget vs actual, custom column reports
- Staff management with bulk select, bulk edit, bulk delete, import preview
- Active sessions view, force logout
- Delegation of approval authority
- Org chart, audit trail, dark/light mode
- Supabase real-time sync + localStorage offline fallback
