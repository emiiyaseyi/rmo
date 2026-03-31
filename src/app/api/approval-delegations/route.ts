import { query } from '@/lib/db'
import { rowToApprovalDelegation, approvalDelegationToRow, buildUpsert } from '../_helpers/mappers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const rows = userId
    ? await query('SELECT * FROM approval_delegations WHERE task_owner_id = $1 OR delegate_id = $1 ORDER BY created_at DESC', [userId])
    : await query('SELECT * FROM approval_delegations ORDER BY created_at DESC')
  return Response.json(rows.map(rowToApprovalDelegation))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    for (const item of items) {
      const row = approvalDelegationToRow(item)
      const { text, values } = buildUpsert('approval_delegations', row)
      await query(text, values)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
