import { query } from '@/lib/db'
import { rowToBulkImportLog, bulkImportLogToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM bulk_import_logs ORDER BY timestamp DESC')
  return Response.json(rows.map(rowToBulkImportLog))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = bulkImportLogToRow(body)
    const { text, values } = buildUpsert('bulk_import_logs', row)
    await query(text, values)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
