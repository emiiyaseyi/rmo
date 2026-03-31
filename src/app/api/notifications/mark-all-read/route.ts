import { pool } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [userId])
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
