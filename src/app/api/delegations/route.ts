import { query } from '@/lib/db'
import { rowToDelegation, delegationToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM delegations ORDER BY created_at DESC')
  return Response.json(rows.map(rowToDelegation))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = delegationToRow(item)
      const { text, values } = buildUpsert('delegations', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
