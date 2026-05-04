import { query } from '@/lib/db'
import { rowToProject, projectToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM projects ORDER BY name')
  return Response.json(rows.map(rowToProject), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = projectToRow(body)
    const { text, values } = buildUpsert('projects', row)
    await query(text, values)
    return Response.json(rowToProject(row), { status: 201 })
  } catch (err) {
    console.error('POST /api/projects error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
