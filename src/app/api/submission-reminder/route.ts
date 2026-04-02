import { query, queryOne, pool } from '@/lib/db'
import { sendTimesheetReminderEmail } from '@/lib/email'
import { getSubmissionWindowStatus, getWeekKey } from '@/lib/utils'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const settings = body.settings ?? null

    if (!settings?.submissionWindow?.enabled) {
      return Response.json({ ok: true, action: 'window_disabled' })
    }

    const windowStatus = getSubmissionWindowStatus(settings.submissionWindow)

    // Only fire if window is currently open and deadline is within 30 minutes
    if (!windowStatus.isOpen || !windowStatus.deadline) {
      return Response.json({ ok: true, action: 'window_not_open' })
    }

    const now = new Date()
    const minutesUntilClose = (windowStatus.deadline.getTime() - now.getTime()) / 60_000

    if (minutesUntilClose > 30 || minutesUntilClose < 0) {
      return Response.json({ ok: true, action: 'not_in_reminder_window', minutesUntilClose: Math.round(minutesUntilClose) })
    }

    // Derive current week key
    const weekKey = getWeekKey(now)

    // Check if we already sent the reminder this cycle (within the last hour)
    const lastReminderRow = await queryOne<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'submission_reminder_sent_at'`
    )
    if (lastReminderRow?.value) {
      const lastSent = new Date(lastReminderRow.value)
      const hoursSinceLastSend = (now.getTime() - lastSent.getTime()) / 3_600_000
      if (hoursSinceLastSend < 1) {
        return Response.json({ ok: true, action: 'already_sent_recently', lastSent: lastReminderRow.value })
      }
    }

    // Find staff who haven't submitted this week (not exempt, active, have an email)
    const allStaff = await query<{ id: string; name: string; email: string; exempt_from_timesheet: boolean }>(
      `SELECT id, name, email, exempt_from_timesheet
       FROM staff
       WHERE status = 'active' AND suspended = false AND email IS NOT NULL AND email <> ''`
    )

    const submittedStaffIds = new Set(
      (await query<{ staff_id: string }>(
        `SELECT DISTINCT staff_id FROM timesheet_entries
         WHERE week_key = $1 AND status IN ('submitted','resubmitted','approved','pending_2nd_approval') AND deleted = false`,
        [weekKey]
      )).map(r => r.staff_id)
    )

    const toRemind = allStaff.filter(s => !s.exempt_from_timesheet && !submittedStaffIds.has(s.id))

    if (toRemind.length === 0) {
      return Response.json({ ok: true, action: 'all_submitted', weekKey })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rmo.dsnsandbox.com'
    const deadline = windowStatus.deadline.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })

    // Send reminder emails in parallel (best effort)
    await Promise.allSettled(
      toRemind.map(s =>
        sendTimesheetReminderEmail(
          s.email,
          s.name,
          weekKey,
          deadline,
          `${baseUrl}/timesheet`
        )
      )
    )

    // Record send time
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('submission_reminder_sent_at', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [now.toISOString()]
    )

    return Response.json({ ok: true, action: 'reminders_sent', count: toRemind.length, weekKey })
  } catch (err) {
    console.error('Submission reminder error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
