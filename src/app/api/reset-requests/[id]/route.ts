import { pool } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, resolvedBy, resolvedAt } = body
    await pool.query(
      `UPDATE reset_requests SET status = $1, resolved_by = $2, resolved_at = $3 WHERE id = $4`,
      [status ?? 'resolved', resolvedBy ?? null, resolvedAt ?? new Date().toISOString(), id]
    )
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await pool.query('DELETE FROM reset_requests WHERE id = $1', [id])
  return Response.json({ ok: true })
}
