import { pool } from '@/lib/db'
import { rowToDelegation, delegationToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = delegationToRow({ ...body, id })
    const { text, values } = buildUpsert('delegations', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToDelegation(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
