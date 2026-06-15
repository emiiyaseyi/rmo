import { query, queryOne } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { getSubmissionWindowStatus } from '@/lib/utils'
import { render } from '@react-email/components'
import { ReviewWindowEmail } from '@/emails/ReviewWindowEmail'
import * as React from 'react'

/**
 * Daily review reminder for team leads / admins with pending reviews.
 *
 * Fires after the submission window closes and re-fires daily while the review
 * window is open and pending entries remain. Each lead only gets an email if
 * they personally still have unreviewed entries for the current week.
 */
export async function GET(req: Request) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  // Load global settings (same shape the client uses)
  const settingsRow = await queryOne<{ value: any }>('SELECT value FROM settings WHERE key = $1', ['global'])
  const settings = settingsRow?.value ?? null

  const reviewEnabled: boolean = settings?.reviewWindow?.enabled ?? true
  if (!reviewEnabled) return Response.json({ skipped: true, reason: 'review_window_disabled' })

  const hoursAfterClose: number = settings?.reviewWindow?.hoursAfterClose ?? 24

  const windowStatus = getSubmissionWindowStatus(settings?.submissionWindow)
  const submissionDeadline = windowStatus.deadline
  if (!submissionDeadline) {
    return Response.json({ skipped: true, reason: 'no_window_configured' })
  }

  // Only nudge after the submission window has closed
  if (!windowStatus.isPastDeadline) {
    return Response.json({ skipped: true, reason: 'window_still_open' })
  }

  // Only within the review window (deadline + hoursAfterClose)
  const reviewDeadline = new Date(submissionDeadline.getTime() + hoursAfterClose * 60 * 60 * 1000)
  const now = new Date()
  if (now > reviewDeadline) {
    return Response.json({ skipped: true, reason: 'review_window_closed' })
  }

  // Derive week key (Monday) from submission deadline
  const weekStart = new Date(submissionDeadline)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekKey = weekStart.toISOString().slice(0, 10)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rmo.dsnsandbox.com'
  const deadlineStr = reviewDeadline.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  // Fetch team leads & admins with valid emails
  const leads = await query<{ id: string; name: string; email: string; role: string }>(
    `SELECT id, name, email, role FROM staff
     WHERE role IN ('team_lead','admin') AND status = 'active'
       AND email IS NOT NULL AND email != ''`
  )

  let sent = 0
  let skipped = 0
  await Promise.all(leads.map(async lead => {
    const pendingRows = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM timesheet_entries
       WHERE lead_id = $1 AND week_key = $2 AND status IN ('submitted','resubmitted') AND deleted = false`,
      [lead.id, weekKey]
    )
    const pendingCount = parseInt(pendingRows[0]?.count ?? '0', 10)
    if (pendingCount === 0) { skipped++; return }

    const html = await render(
      React.createElement(ReviewWindowEmail, {
        leadName: lead.name,
        weekKey,
        reviewDeadline: deadlineStr,
        pendingCount,
        actionUrl: `${baseUrl}/approvals`,
      })
    )
    await sendEmail(
      { to: lead.email, subject: `Action Required: Review ${pendingCount} timesheet${pendingCount !== 1 ? 's' : ''} by ${deadlineStr}` },
      html
    )
    sent++
  }))

  console.log(`[review-reminder] week=${weekKey} sent=${sent} skipped=${skipped}`)
  return Response.json({ sent, skipped, weekKey, reviewDeadline: deadlineStr })
}
