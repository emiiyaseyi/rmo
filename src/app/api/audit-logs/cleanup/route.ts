import { pool } from '@/lib/db'

export async function DELETE() {
  try {
    const result = await pool.query(
      `DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '3 months'`
    )
    return Response.json({ deleted: result.rowCount })
  } catch (err) {
    console.error('Audit log cleanup error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
