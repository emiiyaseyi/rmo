import { query } from '@/lib/db'
import { rowToStreakRecovery, streakRecoveryToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM streak_recoveries ORDER BY created_at DESC')
  return Response.json(rows.map(rowToStreakRecovery))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = streakRecoveryToRow(item)
      const { text, values } = buildUpsert('streak_recoveries', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
