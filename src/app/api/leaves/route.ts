import { query } from '@/lib/db'
import { rowToLeave, leaveToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const role    = searchParams.get('role')
  const staffId = searchParams.get('staffId')
  const rows = role === 'admin'
    ? await query('SELECT * FROM leaves ORDER BY created_at DESC')
    : await query('SELECT * FROM leaves WHERE staff_id = $1 ORDER BY created_at DESC', [staffId])
  return Response.json(rows.map(rowToLeave))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = leaveToRow(body)
    const { text, values } = buildUpsert('leaves', row)
    await query(text, values)
    return Response.json(rowToLeave(row), { status: 201 })
  } catch (err) {
    console.error('POST /api/leaves error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
