import { query, pool } from '@/lib/db'
import { rowToResetRequest, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM reset_requests ORDER BY requested_at DESC')
  return Response.json(rows.map(rowToResetRequest))
}

export async function POST(req: Request) {
  try {
    const d = await req.json()
    await pool.query(
      `INSERT INTO reset_requests (id, staff_id, staff_name, email, requested_at, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [d.id, d.staffId, d.staffName ?? '', d.email ?? null, d.requestedAt ?? new Date().toISOString()]
    )
    return Response.json({ ok: true })
  } catch (err) {
    console.error('POST /api/reset-requests error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
