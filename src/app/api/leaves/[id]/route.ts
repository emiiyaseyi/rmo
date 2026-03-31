import { pool } from '@/lib/db'
import { rowToLeave, leaveToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = leaveToRow({ ...body, id })
    const { text, values } = buildUpsert('leaves', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToLeave(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
