import { query, queryOne } from '@/lib/db'
import {
  rowToStaff, rowToEntry, rowToNotification, rowToApprovalDelegation,
  rowToReward, rowToRedeem, rowToAnnouncement,
  rowToPublicHoliday, rowToProject, rowToTemplate,
} from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const role   = searchParams.get('role')
  const lastSync = searchParams.get('lastSync') // ISO timestamp — only return records changed after this
  if (!userId || !role) {
    return Response.json({ error: 'missing params' }, { status: 400 })
  }
  const isAdmin = role === 'admin'
  const isLead  = role === 'team_lead'

  try {
    // Delta filter: only fetch records updated after lastSync when provided
    const since = lastSync ? new Date(lastSync) : null
    const sinceValid = since && !isNaN(since.getTime())

    const [
      staffRows,
      entriesRows,
      notifRows,
      approvalDelRows,
      settingsRow,
      rewardsRows,
      redeemsRows,
      announcementsRows,
      holidaysRows,
      projectsRows,
      currentUser,
      templatesRows,
    ] = await Promise.all([
      // Staff: delta for admins/leads; full list on first load
      sinceValid
        ? query(`SELECT * FROM staff WHERE updated_at > $1 ORDER BY name`, [since])
        : query('SELECT * FROM staff ORDER BY name'),

      // Entries: always delta-filtered when possible
      isAdmin
        ? sinceValid
          ? query('SELECT * FROM timesheet_entries WHERE deleted = false AND updated_at > $1 ORDER BY created_at DESC', [since])
          : query('SELECT * FROM timesheet_entries WHERE deleted = false ORDER BY created_at DESC')
        : sinceValid
          ? query(`
              SELECT te.* FROM timesheet_entries te
              LEFT JOIN staff s ON s.id = $1
              WHERE te.deleted = false
                AND te.updated_at > $2
                AND (
                  te.staff_id = $1
                  OR te.lead_id = $1
                  OR (te.lead_id IS NULL AND LOWER(te.lead) = LOWER(s.name))
                  OR (te.lead_id = '' AND LOWER(te.lead) = LOWER(s.name))
                )
              ORDER BY te.created_at DESC
            `, [userId, since])
          : query(`
              SELECT te.* FROM timesheet_entries te
              LEFT JOIN staff s ON s.id = $1
              WHERE te.deleted = false
                AND (
                  te.staff_id = $1
                  OR te.lead_id = $1
                  OR (te.lead_id IS NULL AND LOWER(te.lead) = LOWER(s.name))
                  OR (te.lead_id = '' AND LOWER(te.lead) = LOWER(s.name))
                )
              ORDER BY te.created_at DESC
            `, [userId]),

      // Notifications: delta when possible
      isAdmin
        ? sinceValid
          ? query('SELECT * FROM notifications WHERE created_at > $1 ORDER BY created_at DESC LIMIT 200', [since])
          : query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')
        : sinceValid
          ? query('SELECT * FROM notifications WHERE user_id = $1 AND created_at > $2 ORDER BY created_at DESC LIMIT 100', [userId, since])
          : query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]),

      query('SELECT * FROM approval_delegations WHERE task_owner_id = $1 OR delegate_id = $1', [userId]),
      queryOne('SELECT value FROM settings WHERE key = $1', ['global']),

      // Stable data — only fetch on full load (no lastSync) or weekly cadence handled client-side
      sinceValid ? Promise.resolve([]) : query('SELECT * FROM rewards ORDER BY name'),
      sinceValid ? Promise.resolve([]) : query('SELECT * FROM redeems ORDER BY created_at DESC LIMIT 200'),
      sinceValid ? Promise.resolve([]) : query('SELECT * FROM announcements ORDER BY created_at DESC'),
      sinceValid ? Promise.resolve([]) : query('SELECT * FROM public_holidays ORDER BY date'),
      sinceValid ? Promise.resolve([]) : query('SELECT * FROM projects ORDER BY name'),

      queryOne<{ force_logout: boolean }>('SELECT force_logout FROM staff WHERE id = $1', [userId]),
      query('SELECT * FROM templates WHERE staff_id = $1 ORDER BY created_at DESC', [userId]),
    ])

    const body: Record<string, any> = {
      staff:               staffRows.map(rowToStaff),
      entries:             entriesRows.map(rowToEntry),
      notifications:       notifRows.map(rowToNotification),
      approvalDelegations: approvalDelRows.map(rowToApprovalDelegation),
      settings:            settingsRow?.value ?? null,
      templates:           templatesRows.map(rowToTemplate),
      forceLogout:         currentUser?.force_logout ?? false,
      // Signals whether this was a delta response so client can merge vs replace
      isDelta:             !!sinceValid,
    }

    // Only include stable data on full loads
    if (!sinceValid) {
      body.rewards       = rewardsRows.map(rowToReward)
      body.redeems       = redeemsRows.map(rowToRedeem)
      body.announcements = announcementsRows.map(rowToAnnouncement)
      body.publicHolidays = holidaysRows.map(rowToPublicHoliday)
      body.projects      = projectsRows.map(rowToProject)
    }

    return Response.json(body)
  } catch (err) {
    console.error('Poll error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
