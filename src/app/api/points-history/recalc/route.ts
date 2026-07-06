import { pool } from '@/lib/db'
import { getWeekKey } from '@/lib/utils'

// Atomic, deterministic reconcile: staff.points is the floored sum of every
// points_history row for that staff, and current_week_points is the sum for the
// current week. Repairs drift left by any submission that recorded a
// points_history row without incrementing the staff total. Safe to re-run.
export async function POST() {
  const client = await pool.connect()
  try {
    const week = getWeekKey()
    await client.query('BEGIN')
    const r = await client.query(
      `UPDATE staff s SET points = GREATEST(0, COALESCE(
         (SELECT sum(points) FROM points_history ph WHERE ph.staff_id = s.id), 0))`
    )
    await client.query(
      `UPDATE staff s SET current_week_points = GREATEST(0, COALESCE(
         (SELECT sum(points) FROM points_history ph WHERE ph.staff_id = s.id AND ph.week_id = $1), 0))`,
      [week]
    )
    await client.query('COMMIT')
    return Response.json({ ok: true, updated: r.rowCount, week })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/points-history/recalc error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }
}
