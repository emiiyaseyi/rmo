import { pool } from '@/lib/db'
import { rowToRedeem, redeemToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = redeemToRow({ ...body, id })
    const { text, values } = buildUpsert('redeems', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToRedeem(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
