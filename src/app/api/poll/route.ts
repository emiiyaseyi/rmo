import { query, queryOne } from '@/lib/db'
import {
  rowToStaff, rowToEntry, rowToNotification, rowToApprovalDelegation,
  rowToReward, rowToRedeem, rowToAnnouncement,
  rowToPublicHoliday, rowToAuditLog, rowToProject, rowToTemplate,
} from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const role   = searchParams.get('role')
  if (!userId || !role) {
    return Response.json({ error: 'missing params' }, { status: 400 })
  }
  const isAdmin = role === 'admin'

  try {
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
      auditRows,
      projectsRows,
      currentUser,
      templatesRows,
    ] = await Promise.all([
      query('SELECT * FROM staff ORDER BY name'),
      isAdmin
        ? query('SELECT * FROM timesheet_entries WHERE deleted = false ORDER BY created_at DESC')
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
      isAdmin
        ? query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1000')
        : query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [userId]),
      query('SELECT * FROM approval_delegations WHERE task_owner_id = $1 OR delegate_id = $1', [userId]),
      queryOne('SELECT value FROM settings WHERE key = $1', ['global']),

      query('SELECT * FROM rewards ORDER BY name'),
      query('SELECT * FROM redeems ORDER BY created_at DESC'),
      query('SELECT * FROM announcements ORDER BY created_at DESC'),
      query('SELECT * FROM public_holidays ORDER BY date'),
      query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 2000'),
      query('SELECT * FROM projects ORDER BY name'),
      queryOne<{ force_logout: boolean }>('SELECT force_logout FROM staff WHERE id = $1', [userId]),
      query('SELECT * FROM templates WHERE staff_id = $1 ORDER BY created_at DESC', [userId]),
    ])

    return Response.json({
      staff:               staffRows.map(rowToStaff),
      entries:             entriesRows.map(rowToEntry),
      notifications:       notifRows.map(rowToNotification),
      approvalDelegations: approvalDelRows.map(rowToApprovalDelegation),
      settings:            settingsRow?.value ?? null,

      rewards:             rewardsRows.map(rowToReward),
      redeems:             redeemsRows.map(rowToRedeem),
      announcements:       announcementsRows.map(rowToAnnouncement),
      publicHolidays:      holidaysRows.map(rowToPublicHoliday),
      auditLogs:           auditRows.map(rowToAuditLog),
      projects:            projectsRows.map(rowToProject),
      templates:           templatesRows.map(rowToTemplate),
      forceLogout:         currentUser?.force_logout ?? false,
    })
  } catch (err) {
    console.error('Poll error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
