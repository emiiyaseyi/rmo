import { pool } from '@/lib/db'
import { rowToPasswordResetRequest, passwordResetRequestToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = passwordResetRequestToRow({ ...body, id })
    const { text, values } = buildUpsert('password_reset_requests', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToPasswordResetRequest(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
