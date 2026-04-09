import { queryOne, pool } from '@/lib/db'
import { rowToStaff, staffToRow, buildUpsert } from '../../_helpers/mappers'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await queryOne('SELECT * FROM staff WHERE id = $1', [id])
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(rowToStaff(row))
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Check if staff member already exists
    const existing = await queryOne('SELECT id FROM staff WHERE id = $1', [id])

    if (!existing) {
      // New staff member — full upsert insert
      const row = staffToRow({ ...body, id })
      const { text, values } = buildUpsert('staff', row)
      await pool.query(text, values)
      const inserted = await queryOne('SELECT * FROM staff WHERE id = $1', [id])
      return Response.json(rowToStaff(inserted), { status: 201 })
    }

    // Existing staff member — partial update with only provided fields
    const fieldMap: Record<string, string> = {
      name: 'name', email: 'email', password: 'password', role: 'role',
      department: 'department', jobTitle: 'job_title', status: 'status',
      suspended: 'suspended', first_login: 'first_login',
      mustChangePassword: 'must_change_password', points: 'points',
      streak: 'streak', currentWeekPoints: 'current_week_points',
      lastSubmittedWeek: 'last_submitted_week', badges: 'badges',
      profilePhoto: 'profile_photo', photoUrl: 'photo_url', phone: 'phone',
      leadId: 'lead_id', leadName: 'lead_name', staffType: 'staff_type',
      isIntern: 'is_intern', weekly_cap: 'weekly_cap', weekly_goal: 'weekly_goal',
      weeklyHourGoal: 'weekly_hour_goal', cdsDay: 'cds_day', fontSize: 'font_size',
      exemptFromTimesheet: 'exempt_from_timesheet', last_login: 'last_login',
      failed_attempts: 'failed_attempts', lockout_until: 'lockout_until',
      password_reset_pending: 'password_reset_pending', force_logout: 'force_logout',
      tour_done: 'tour_done',
    }

    const setClauses: string[] = []
    const values: any[] = []
    let i = 1
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) {
        const val = body[camel]
        setClauses.push(`${snake} = $${i++}`)
        values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val)
      }
    }
    if (!setClauses.length) return Response.json({ error: 'No fields to update' }, { status: 400 })

    values.push(id)
    await pool.query(`UPDATE staff SET ${setClauses.join(', ')} WHERE id = $${i}`, values)
    const updated = await queryOne('SELECT * FROM staff WHERE id = $1', [id])
    return Response.json(rowToStaff(updated))
  } catch (err) {
    console.error('PUT /api/staff/[id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await pool.query('DELETE FROM staff WHERE id = $1', [id])
  return Response.json({ ok: true })
}
