import { pool } from '@/lib/db'
import { rowToTemplate, templateToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = templateToRow({ ...body, id })
    const { text, values } = buildUpsert('templates', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToTemplate(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await pool.query('DELETE FROM templates WHERE id = $1', [id])
  return Response.json({ ok: true })
}
