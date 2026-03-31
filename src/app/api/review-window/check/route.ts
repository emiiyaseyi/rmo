import { query, queryOne, pool } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { render } from '@react-email/components'
import { ReviewWindowEmail } from '@/emails/ReviewWindowEmail'
import { getSubmissionWindowStatus } from '@/lib/utils'
import * as React from 'react'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const settings = body.settings ?? null
    const windowStatus = getSubmissionWindowStatus(settings?.submissionWindow)

    const hoursAfterClose: number = settings?.reviewWindow?.hoursAfterClose ?? 24
    const penaltyPerEntry: number = settings?.reviewWindow?.penaltyPerEntry ?? -5
    const reviewEnabled: boolean = settings?.reviewWindow?.enabled ?? true

    if (!reviewEnabled) return Response.json({ ok: true, action: 'review_window_disabled' })

    const submissionDeadline = windowStatus.deadline
    if (!submissionDeadline) {
      return Response.json({ ok: true, action: 'no_window_configured' })
    }

    const reviewDeadline = new Date(submissionDeadline.getTime() + hoursAfterClose * 60 * 60 * 1000)
    const now = new Date()

    // Derive the week key from the submission deadline
    const weekStart = new Date(submissionDeadline)
    const day = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1))
    weekStart.setHours(0, 0, 0, 0)
    const weekKey = weekStart.toISOString().slice(0, 10)

    // Submission window must have closed for any action to trigger
    if (!windowStatus.isPastDeadline) {
      return Response.json({ ok: true, action: 'window_still_open' })
    }

    const existing = await queryOne<{
      week_key: string
      review_deadline: string
      penalty_applied: boolean
    }>(
      'SELECT week_key, review_deadline, penalty_applied FROM review_window_log WHERE week_key = $1',
      [weekKey]
    )

    // ── Phase 1: Send notification email (once per cycle, right after window closes) ──
    if (!existing) {
      // Fetch all team leads and admins with emails
      const leads = await query<{ id: string; name: string; email: string; role: string }>(
        `SELECT id, name, email, role FROM staff
         WHERE role IN ('team_lead','admin') AND status = 'active' AND email LIKE '%@datasciencenigeria.ai'`
      )

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rmo.dsnsandbox.com'
      const deadlineStr = reviewDeadline.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })

      // Send each lead a personalised email with their own pending count
      await Promise.all(leads.map(async lead => {
        const pendingRows = await query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM timesheet_entries
           WHERE lead_id = $1 AND week_key = $2 AND status IN ('submitted','resubmitted') AND deleted = false`,
          [lead.id, weekKey]
        )
        const pendingCount = parseInt(pendingRows[0]?.count ?? '0', 10)
        if (pendingCount === 0) return // nothing to review — skip

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
      }))

      // Record notification sent
      await pool.query(
        `INSERT INTO review_window_log (week_key, notified_at, review_deadline, penalty_applied)
         VALUES ($1, NOW(), $2, false)`,
        [weekKey, reviewDeadline.toISOString()]
      )

      return Response.json({ ok: true, action: 'notified', weekKey, reviewDeadline })
    }

    // ── Phase 2: Apply late-review penalties (once, after review deadline passes) ──
    if (!existing.penalty_applied && now > new Date(existing.review_deadline)) {
      // Find all team leads who still have unreviewed submitted entries for this week
      const lateLeads = await query<{ lead_id: string; unreviewed: string }>(
        `SELECT lead_id, COUNT(*) AS unreviewed
         FROM timesheet_entries
         WHERE week_key = $1 AND status IN ('submitted','resubmitted') AND deleted = false AND lead_id IS NOT NULL
         GROUP BY lead_id`,
        [weekKey]
      )

      await Promise.all(lateLeads.map(async row => {
        const count = parseInt(row.unreviewed, 10)
        const penaltyPoints = count * penaltyPerEntry

        // Deduct points from the lead
        await pool.query(
          `UPDATE staff SET points = GREATEST(0, points + $1) WHERE id = $2`,
          [penaltyPoints, row.lead_id]
        )

        // Record in points_history
        await pool.query(
          `INSERT INTO points_history (id, staff_id, week_id, action, points, timestamp)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())`,
          [row.lead_id, weekKey, `Late review penalty (${count} unreviewed)`, penaltyPoints]
        )

        // In-app notification
        await pool.query(
          `INSERT INTO notifications (id, user_id, message, type, read, title, linked_id, linked_type, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, 'warning', false, 'Late Review Penalty', $3, 'entry', NOW())`,
          [
            row.lead_id,
            `You have ${count} unreviewed timesheet${count !== 1 ? 's' : ''} for week ${weekKey}. ${Math.abs(penaltyPoints)} points deducted for late review.`,
            weekKey,
          ]
        )
      }))

      await pool.query(
        `UPDATE review_window_log SET penalty_applied = true, penalty_applied_at = NOW() WHERE week_key = $1`,
        [weekKey]
      )

      return Response.json({ ok: true, action: 'penalties_applied', weekKey, affected: lateLeads.length })
    }

    return Response.json({ ok: true, action: 'already_processed', weekKey })
  } catch (err) {
    console.error('Review window check error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: returns current review window status for the UI
export async function GET() {
  try {
    const rows = await query<{
      week_key: string
      notified_at: string
      review_deadline: string
      penalty_applied: boolean
    }>(
      'SELECT * FROM review_window_log ORDER BY notified_at DESC LIMIT 1'
    )
    return Response.json(rows[0] ?? null)
  } catch (err) {
    console.error('Review window GET error:', err)
    return Response.json(null, { status: 500 })
  }
}
