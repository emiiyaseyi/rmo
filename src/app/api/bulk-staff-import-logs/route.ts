import { query } from '@/lib/db'
import { rowToBulkStaffImportLog, bulkStaffImportLogToRow, buildUpsert } from '../_helpers/mappers'

export async function GET() {
  const rows = await query('SELECT * FROM bulk_staff_import_logs ORDER BY timestamp DESC')
  return Response.json(rows.map(rowToBulkStaffImportLog))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const row = bulkStaffImportLogToRow(body)
    const { text, values } = buildUpsert('bulk_staff_import_logs', row)
    await query(text, values)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
