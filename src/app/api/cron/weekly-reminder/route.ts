import { query } from '@/lib/db'
import { rowToStaff, rowToPublicHoliday } from '../../_helpers/mappers'
import { render } from '@react-email/components'
import { Resend } from 'resend'
import { WeeklyReminderEmail } from '@/emails/WeeklyReminderEmail'
import React from 'react'

// WAT = UTC+1
const WAT_OFFSET_MS = 60 * 60 * 1000

function nowWAT(): Date {
  return new Date(Date.now() + WAT_OFFSET_MS)
}

/**
 * Formats a date as "Monday, 8th June 2026"
 */
function formatDeadlineDay(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const d = date.getUTCDate()
  const suffix = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th'
  return `${days[date.getUTCDay()]}, ${d}${suffix} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * Checks if a given WAT date (YYYY-MM-DD string) is a public holiday.
 */
async function isPublicHoliday(dateStr: string): Promise<boolean> {
  const rows = await query('SELECT * FROM public_holidays WHERE date = $1', [dateStr])
  return rows.length > 0
}

/**
 * Given today in WAT, finds the next working day (Mon–Fri, not a holiday).
 * Returns the date as a WAT Date object.
 */
async function nextWorkingDay(fromWat: Date): Promise<Date> {
  const candidate = new Date(fromWat)
  // Move to next day first
  candidate.setUTCDate(candidate.getUTCDate() + 1)
  for (let i = 0; i < 7; i++) {
    const day = candidate.getUTCDay()
    const dateStr = candidate.toISOString().slice(0, 10)
    const isWeekend = day === 0 || day === 6
    const isHoliday = await isPublicHoliday(dateStr)
    if (!isWeekend && !isHoliday) return candidate
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }
  return candidate
}

export async function GET(req: Request) {
  // Verify Vercel cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const watNow = nowWAT()
  const todayStr = watNow.toISOString().slice(0, 10) // YYYY-MM-DD in WAT
  const todayDayOfWeek = watNow.getUTCDay() // 0=Sun, 1=Mon
  const watHour = watNow.getUTCHours()

  // Determine if this is the morning send (9:10 WAT) or last reminder (11:45 WAT)
  // Cron fires at 8:10 UTC and 10:45 UTC = 9:10 WAT and 11:45 WAT
  const isLastReminder = watHour >= 11

  // Check if today is a holiday
  const todayIsHoliday = await isPublicHoliday(todayStr)

  // This cron runs Mon–Fri. If today is a holiday, skip — the next working day
  // will send the reminder when the cron fires on that day naturally.
  // Exception: if Monday is a holiday, we need to send on next working day.
  // The cron only fires Mon–Fri so if Monday is skipped, Tuesday cron picks it up
  // if it's also a non-holiday — but we explicitly handle the Monday case here.
  if (todayIsHoliday) {
    const next = await nextWorkingDay(watNow)
    console.log(`[weekly-reminder] Today (${todayStr}) is a public holiday. Next working day: ${next.toISOString().slice(0, 10)}`)
    return Response.json({ skipped: true, reason: 'public_holiday', nextWorkingDay: next.toISOString().slice(0, 10) })
  }

  // Only send on Monday (morning) or when triggered as last reminder
  // The cron schedule handles timing — we just verify it's a weekday
  if (todayDayOfWeek === 0 || todayDayOfWeek === 6) {
    return Response.json({ skipped: true, reason: 'weekend' })
  }

  // Fetch all active, non-suspended staff with emails
  const staffRows = await query("SELECT * FROM staff WHERE suspended = false AND status = 'active' AND email IS NOT NULL AND email != ''")
  const allStaff = staffRows.map(rowToStaff).filter(s => s.email && s.role !== 'admin')

  if (allStaff.length === 0) {
    return Response.json({ sent: 0, reason: 'no_staff' })
  }

  // Build deadline string: "12:00 noon today, Monday, 8th June 2026"
  const deadlineStr = `12:00 noon today, ${formatDeadlineDay(watNow)}`

  const results = await Promise.allSettled(
    allStaff.map(async (s) => {
      const html = await render(
        React.createElement(WeeklyReminderEmail, {
          staffName: s.name.split(' ')[0], // first name
          deadline: deadlineStr,
          isLastReminder,
          actionUrl: 'http://rmo.dsnsandbox.com',
        })
      )
      return resend.emails.send({
        from: 'DSN RMO <noreply@rmo.dsnsandbox.com>',
        to: s.email!,
        subject: isLastReminder
          ? `⏰ Last Reminder: Submit your Weekly Deliverables today`
          : `📋 Weekly Deliverables Reminder – ${formatDeadlineDay(watNow)}`,
        html,
      })
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`[weekly-reminder] Sent: ${sent}, Failed: ${failed}, isLastReminder: ${isLastReminder}`)

  return Response.json({ sent, failed, isLastReminder, date: todayStr })
}
