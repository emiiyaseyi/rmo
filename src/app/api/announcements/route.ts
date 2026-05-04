import { query } from '@/lib/db'
import { rowToAnnouncement, announcementToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM announcements ORDER BY created_at DESC')
  return Response.json(rows.map(rowToAnnouncement), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = announcementToRow(body)
    const { text, values } = buildUpsert('announcements', row)
    await query(text, values)
    return Response.json(rowToAnnouncement(row), { status: 201 })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
