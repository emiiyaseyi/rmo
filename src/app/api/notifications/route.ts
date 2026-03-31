import { query } from '@/lib/db'
import { rowToNotification, notificationToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })
  const rows = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
    [userId]
  )
  return Response.json(rows.map(rowToNotification))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = notificationToRow(body)
    const { text, values } = buildUpsert('notifications', row)
    await query(text, values)
    return Response.json(rowToNotification(row), { status: 201 })
  } catch (err) {
    console.error('POST /api/notifications error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
