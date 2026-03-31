import { query } from '@/lib/db'
import { rowToBudget, budgetToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM budgets ORDER BY created_at DESC')
  return Response.json(rows.map(rowToBudget))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = budgetToRow(item)
      const { text, values } = buildUpsert('budgets', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
