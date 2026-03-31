import { pool, queryOne } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key') ?? 'global'
  const row = await queryOne('SELECT value FROM settings WHERE key = $1', [key])
  return Response.json(row?.value ?? {})
}

export async function PUT(req: Request) {
  try {
    const { key = 'global', value } = await req.json()
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    )
    return Response.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/settings error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
