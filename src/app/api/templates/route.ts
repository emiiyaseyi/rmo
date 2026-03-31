import { query } from '@/lib/db'
import { rowToTemplate, templateToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staffId')
  const rows = staffId
    ? await query('SELECT * FROM templates WHERE staff_id = $1 ORDER BY created_at DESC', [staffId])
    : await query('SELECT * FROM templates ORDER BY created_at DESC')
  return Response.json(rows.map(rowToTemplate))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = templateToRow(item)
      const { text, values } = buildUpsert('templates', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
