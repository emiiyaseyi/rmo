import { pool } from '@/lib/db'
import { rowToStreakRecovery, streakRecoveryToRow, buildUpsert } from '../../_helpers/mappers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const row = streakRecoveryToRow({ ...body, id })
    const { text, values } = buildUpsert('streak_recoveries', row)
    const result = await pool.query(text + ' RETURNING *', values)
    return Response.json(rowToStreakRecovery(result.rows[0]))
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
