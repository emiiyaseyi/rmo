import { query } from '@/lib/db'
import { rowToHof, hofToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM hof ORDER BY rank ASC')
  return Response.json(rows.map(rowToHof))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = hofToRow(item)
      const { text, values } = buildUpsert('hof', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
