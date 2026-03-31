import { query } from '@/lib/db'
import { rowToPasswordResetRequest, passwordResetRequestToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM password_reset_requests ORDER BY requested_at DESC')
  return Response.json(rows.map(rowToPasswordResetRequest))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = passwordResetRequestToRow(item)
      const { text, values } = buildUpsert('password_reset_requests', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
