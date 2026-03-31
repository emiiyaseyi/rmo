import { queryOne, query } from '@/lib/db'
import { rowToStaff } from '../../_helpers/mappers'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return Response.json({ error: 'email required' }, { status: 400 })

    const row = await queryOne('SELECT * FROM staff WHERE email = $1', [email.toLowerCase().trim()])
    if (!row) return Response.json({ error: 'not found' }, { status: 404 })

    return Response.json(rowToStaff(row))
  } catch (err) {
    console.error('Login lookup error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
