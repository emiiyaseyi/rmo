import { query } from '@/lib/db'
import { rowToProjectBudget, projectBudgetToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM project_budgets ORDER BY updated_at DESC')
  return Response.json(rows.map(rowToProjectBudget))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = projectBudgetToRow(item)
      const { text, values } = buildUpsert('project_budgets', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
