import { query } from '@/lib/db'
import { rowToPointsHistory, pointsHistoryToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staffId')
  const rows = staffId
    ? await query('SELECT * FROM points_history WHERE staff_id = $1 ORDER BY timestamp DESC', [staffId])
    : await query('SELECT * FROM points_history ORDER BY timestamp DESC LIMIT 500')
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
