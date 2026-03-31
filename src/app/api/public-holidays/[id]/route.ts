import { pool } from '@/lib/db'
import { rowToPublicHoliday, publicHolidayToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = publicHolidayToRow({ ...body, id })
    const { text, values } = buildUpsert('public_holidays', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToPublicHoliday(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await pool.query('DELETE FROM public_holidays WHERE id = $1', [id])
  return Response.json({ ok: true })
}
