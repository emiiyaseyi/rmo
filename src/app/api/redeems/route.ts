import { query } from '@/lib/db'
import { rowToRedeem, redeemToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM redeems ORDER BY created_at DESC')
  return Response.json(rows.map(rowToRedeem))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = redeemToRow(item)
      const { text, values } = buildUpsert('redeems', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
