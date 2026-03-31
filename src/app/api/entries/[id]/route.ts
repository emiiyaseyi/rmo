import { pool } from '@/lib/db'
import { rowToEntry, entryToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = entryToRow({ ...body, id })
    const { text, values } = buildUpsert('timesheet_entries', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToEntry(result.rows[0]))
  } catch (err) {
    console.error('PUT /api/entries/[id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await pool.query(`UPDATE timesheet_entries SET deleted = true, deleted_at = NOW() WHERE id = $1`, [id])
  return Response.json({ ok: true })
}
