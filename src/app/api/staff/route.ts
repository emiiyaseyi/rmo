import { query } from '@/lib/db'
import { rowToStaff, staffToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM staff ORDER BY name')
  return Response.json(rows.map(rowToStaff))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = staffToRow(body)
    const { text, values } = buildUpsert('staff', row)
    await query(text, values)
    return Response.json(rowToStaff(row), { status: 201 })
  } catch (err) {
    console.error('POST /api/staff error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
