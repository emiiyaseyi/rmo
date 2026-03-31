import { pool } from '@/lib/db'
import { rowToReward, rewardToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = rewardToRow({ ...body, id })
    const { text, values } = buildUpsert('rewards', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToReward(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await pool.query('DELETE FROM rewards WHERE id = $1', [id])
  return Response.json({ ok: true })
}
