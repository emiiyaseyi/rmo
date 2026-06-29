import { query } from '@/lib/db'

// Server-side reviewal leaderboard: review-speed score per reviewer, computed
// from ALL timesheet entries (not the viewer's scoped subset). Speed = hours
// from submitted_at → reviewed_at (approved_at/rejected_at, else updated_at).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // YYYY-MM-DD inclusive (by reviewed date)
  const to   = searchParams.get('to')

  // Optional reviewed-date window
  const dateFilter = (from && to)
    ? `AND COALESCE(CASE WHEN te.status='approved' THEN te.approved_at ELSE te.rejected_at END, te.updated_at)::date BETWEEN $1 AND $2`
    : ''
  const params = (from && to) ? [from, to] : []

  const rows = await query<{ rid: string; reviewed: string; avg_score: string }>(
    `
    WITH rev AS (
      SELECT
        CASE WHEN te.status='approved' THEN te.approved_by ELSE te.rejected_by END AS rid,
        EXTRACT(EPOCH FROM (
          COALESCE(CASE WHEN te.status='approved' THEN te.approved_at ELSE te.rejected_at END, te.updated_at)
          - te.submitted_at
        ))/3600 AS hrs
      FROM timesheet_entries te
      WHERE te.deleted = false
        AND te.status IN ('approved','rejected')
        AND te.submitted_at IS NOT NULL
        ${dateFilter}
    )
    SELECT rid,
           COUNT(*)::int AS reviewed,
           ROUND(AVG(CASE
             WHEN hrs <= 6   THEN 100
             WHEN hrs <= 24  THEN 90
             WHEN hrs <= 48  THEN 75
             WHEN hrs <= 72  THEN 60
             WHEN hrs <= 168 THEN 40
             ELSE 20 END))::int AS avg_score
    FROM rev
    WHERE rid IS NOT NULL AND rid <> ''
    GROUP BY rid
    `,
    params
  )

  const stats: Record<string, { reviewed: number; avgScore: number }> = {}
  for (const r of rows) stats[r.rid] = { reviewed: Number(r.reviewed), avgScore: Number(r.avg_score) }
  return Response.json(stats, { headers: { 'Cache-Control': 'no-store' } })
}
