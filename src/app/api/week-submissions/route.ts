import { query, pool } from '@/lib/db'
import { rowToWeekSubmission } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staffId')
  const weekKey = searchParams.get('weekKey')
  if (staffId && weekKey) {
    const rows = await query('SELECT * FROM week_submissions WHERE staff_id = $1 AND week_key = $2', [staffId, weekKey])
    return Response.json(rows.map(rowToWeekSubmission))
  }
  if (staffId) {
    const rows = await query('SELECT * FROM week_submissions WHERE staff_id = $1 ORDER BY submitted_at DESC', [staffId])
    return Response.json(rows.map(rowToWeekSubmission))
  }
  const rows = await query('SELECT * FROM week_submissions ORDER BY submitted_at DESC')
  return Response.json(rows.map(rowToWeekSubmission))
}

export async function POST(req: Request) {
  try {
    const d = await req.json()
    await pool.query(
      `INSERT INTO week_submissions (id, staff_id, week_key, status, submitted_at, total_hours, late_penalty, is_late)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (staff_id, week_key) DO UPDATE SET
         status = $4, submitted_at = $5, total_hours = $6, late_penalty = $7, is_late = $8`,
      [d.id, d.staffId, d.weekKey, d.status ?? 'submitted',
       d.submittedAt ?? new Date().toISOString(),
       d.totalHours ?? 0, d.latePenalty ?? null, d.isLate ?? false]
    )
    return Response.json({ ok: true })
  } catch (err) {
    console.error('POST /api/week-submissions error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
