import { query, pool } from '@/lib/db'
import { rowToAuditLog, auditLogToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit  = Math.min(Number(searchParams.get('limit')  ?? 50), 200)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0),  0)
  const rows = await query(
    'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  )
  const countRow = await query('SELECT COUNT(*)::int AS total FROM audit_logs', [])
  return Response.json({
    logs: rows.map(rowToAuditLog),
    total: countRow[0]?.total ?? 0,
    offset,
    limit,
  })
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
