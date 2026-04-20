import { pool } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'id required' }, { status: 400 })
    await pool.query('UPDATE notifications SET read = true WHERE id = $1', [id])
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
