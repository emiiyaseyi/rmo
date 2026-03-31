import { query } from '@/lib/db'
import { rowToWeekLock, weekLockToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM week_locks ORDER BY locked_at DESC')
  return Response.json(rows.map(rowToWeekLock))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = weekLockToRow(item)
      const { text, values } = buildUpsert('week_locks', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
