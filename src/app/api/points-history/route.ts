import { query } from '@/lib/db'
import { rowToPointsHistory, pointsHistoryToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staffId')
  const weekId  = searchParams.get('weekId')   // e.g. "2026-05-05"
  const month   = searchParams.get('month')    // e.g. "2026-05"
  const from    = searchParams.get('from')      // e.g. "2026-05-01" (inclusive, by week_id)
  const to      = searchParams.get('to')        // e.g. "2026-06-30" (inclusive, by week_id)

  let rows: any[]
  // Custom date range: filter by week_id between from and to (week_id is YYYY-MM-DD, lexically sortable)
  if (from && to) {
    rows = staffId
      ? await query('SELECT * FROM points_history WHERE staff_id = $1 AND week_id >= $2 AND week_id <= $3 ORDER BY timestamp DESC', [staffId, from, to])
      : await query('SELECT * FROM points_history WHERE week_id >= $1 AND week_id <= $2 ORDER BY timestamp DESC LIMIT 5000', [from, to])
  } else if (staffId && weekId) {
    rows = await query('SELECT * FROM points_history WHERE staff_id = $1 AND week_id = $2 ORDER BY timestamp DESC', [staffId, weekId])
  } else if (staffId && month) {
    rows = await query("SELECT * FROM points_history WHERE staff_id = $1 AND week_id LIKE $2 ORDER BY timestamp DESC", [staffId, `${month}%`])
  } else if (staffId) {
    rows = await query('SELECT * FROM points_history WHERE staff_id = $1 ORDER BY timestamp DESC', [staffId])
  } else if (weekId) {
    rows = await query('SELECT * FROM points_history WHERE week_id = $1 ORDER BY timestamp DESC', [weekId])
  } else if (month) {
    rows = await query("SELECT * FROM points_history WHERE week_id LIKE $1 ORDER BY timestamp DESC LIMIT 2000", [`${month}%`])
  } else {
    rows = await query('SELECT * FROM points_history ORDER BY timestamp DESC LIMIT 2000')
  }
  return Response.json(rows.map(rowToPointsHistory))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = pointsHistoryToRow(item)
      const { text, values } = buildUpsert('points_history', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
