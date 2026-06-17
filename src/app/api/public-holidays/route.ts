import { query } from '@/lib/db'
import { rowToPublicHoliday, publicHolidayToRow, buildUpsert } from '../_helpers/mappers'

// Self-healing: ensure the `type` column exists (added in 2026 redesign)
async function ensureTypeColumn() {
  try { await query("ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'public'") } catch {}
}

export async function GET() {
  await ensureTypeColumn()
  const rows = await query('SELECT * FROM public_holidays ORDER BY date')
  return Response.json(rows.map(rowToPublicHoliday), {
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(req: Request) {
  try {
    await ensureTypeColumn()
    const body = await req.json()
    const row = publicHolidayToRow(body)
    const { text, values } = buildUpsert('public_holidays', row)
    await query(text, values)
    return Response.json(rowToPublicHoliday(row), { status: 201 })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
