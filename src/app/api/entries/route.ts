import { query } from '@/lib/db'
import { rowToEntry, entryToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const role    = searchParams.get('role')
  const staffId = searchParams.get('staffId')

  const rows = role === 'admin'
    ? await query('SELECT * FROM timesheet_entries WHERE deleted = false ORDER BY created_at DESC')
    : await query('SELECT * FROM timesheet_entries WHERE staff_id = $1 AND deleted = false ORDER BY created_at DESC', [staffId])

  return Response.json(rows.map(rowToEntry))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = entryToRow(body)
    const { text, values } = buildUpsert('timesheet_entries', row)
    await query(text, values)
    return Response.json(rowToEntry(row), { status: 201 })
  } catch (err) {
    console.error('POST /api/entries error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
