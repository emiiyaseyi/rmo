import { query, pool } from '@/lib/db'
import { rowToAuditLog, auditLogToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 2000), 2000)
  const rows = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1', [limit])
  return Response.json(rows.map(rowToAuditLog))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = auditLogToRow(body)
    const { text, values } = buildUpsert('audit_logs', row)
    await query(text, values)
    return Response.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('POST /api/audit-logs error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
