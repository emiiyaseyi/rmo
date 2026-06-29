import { query, queryOne, pool } from '@/lib/db'
import { rowToWeekSubmission } from '../_helpers/mappers'

// Deterministic, idempotent submission-points award (server-side, always has staff_id).
// Awards once per (staff, week).
async function awardSubmissionPoints(staffId: string, weekKey: string, submittedAt: string, isLate: boolean) {
  if (!staffId || !weekKey) return
  const existing = await query(
    "SELECT 1 FROM points_history WHERE staff_id = $1 AND week_id = $2 AND action ILIKE '%submission%' LIMIT 1",
    [staffId, weekKey]
  )
  if (existing.length > 0) return

  const settings = await queryOne<{ value: any }>("SELECT value FROM settings WHERE key = 'global'")
  const cfg = settings?.value?.pointsConfig || {}
  const early3 = cfg.earlySubmission ?? 3
  const onTime = cfg.onTimeSubmission ?? 2
  const outside = cfg.outsideWindowPenalty ?? -1
  const earlyHrs = cfg.earlySubmissionHours ?? 4
  const [sh, sm] = String(settings?.value?.submissionWindow?.schedule?.startTime || '08:00').split(':').map(Number)

  let pts: number, action: string
  if (isLate) { pts = outside; action = 'Outside window submission' }
  else {
    // early cutoff = week Monday + startTime + earlyHrs, in WAT (UTC+1)
    const mondayWatMidnight = new Date(`${weekKey}T00:00:00+01:00`).getTime()
    const cutoff = mondayWatMidnight + (sh * 60 + sm) * 60000 + earlyHrs * 3600000
    const isEarly = new Date(submittedAt).getTime() < cutoff
    pts = isEarly ? early3 : onTime
    action = isEarly ? 'Early submission bonus' : 'On-time submission'

    // Early-streak bonus: 3 consecutive prior early weeks → +1 on this early submission
    if (isEarly) {
      const monMs = new Date(`${weekKey}T00:00:00Z`).getTime()
      const prev3 = [7, 14, 21].map(d => new Date(monMs - d * 86400000).toISOString().slice(0, 10))
      const streakRows = await query(
        "SELECT DISTINCT week_id FROM points_history WHERE staff_id = $1 AND action ILIKE 'Early submission%' AND week_id = ANY($2)",
        [staffId, prev3]
      )
      if (streakRows.length >= 3) { pts += 1; action = 'Early submission bonus (streak +1)' }
    }
  }

  await pool.query(
    'INSERT INTO points_history (id, staff_id, week_id, action, points, timestamp) VALUES ($1,$2,$3,$4,$5,$6)',
    [`${staffId}_${weekKey}_pts`, staffId, weekKey, action, pts, submittedAt]
  )
  await pool.query(
    'UPDATE staff SET points = GREATEST(0, COALESCE(points,0) + $1), current_week_points = GREATEST(0, COALESCE(current_week_points,0) + $1) WHERE id = $2',
    [pts, staffId]
  )
}

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
    // Award submission points server-side (idempotent, once per staff+week)
    await awardSubmissionPoints(d.staffId, d.weekKey, d.submittedAt ?? new Date().toISOString(), d.isLate ?? false)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('POST /api/week-submissions error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
