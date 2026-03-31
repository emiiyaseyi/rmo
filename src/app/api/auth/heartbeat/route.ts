import { pool } from '@/lib/db'

export async function GET() {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const rows = await pool.query(
      `SELECT user_id AS "userId", user_name AS "userName", email, role, department,
              last_seen AS "lastSeen", login_at AS "loginAt"
       FROM active_sessions WHERE last_seen > $1`,
      [cutoff]
    )
    return Response.json(rows.rows)
  } catch (err) {
    console.error('Heartbeat GET error:', err)
    return Response.json([], { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId, userName, email, role, department, lastSeen, loginAt } = await req.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

    await pool.query(
      `INSERT INTO active_sessions (user_id, user_name, email, role, department, last_seen, login_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         user_name = $2, email = $3, role = $4, department = $5, last_seen = $6`,
      [userId, userName ?? '', email ?? '', role ?? '', department ?? '', lastSeen ?? new Date().toISOString(), loginAt ?? new Date().toISOString()]
    )
    return Response.json({ ok: true })
  } catch (err) {
    console.error('Heartbeat error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
