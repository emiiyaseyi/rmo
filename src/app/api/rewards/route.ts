import { query } from '@/lib/db'
import { rowToReward, rewardToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM rewards ORDER BY name')
  return Response.json(rows.map(rowToReward))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = rewardToRow(item)
      const { text, values } = buildUpsert('rewards', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
