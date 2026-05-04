import { query } from '@/lib/db'
import { rowToPublicHoliday, publicHolidayToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM public_holidays ORDER BY date')
  return Response.json(rows.map(rowToPublicHoliday), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = publicHolidayToRow(body)
    const { text, values } = buildUpsert('public_holidays', row)
    await query(text, values)
    return Response.json(rowToPublicHoliday(row), { status: 201 })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
