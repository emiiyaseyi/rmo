import { NextResponse } from 'next/server'
import {
  sendNotificationEmail,
  sendTimesheetApprovalEmail,
  sendTimesheetReminderEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '@/lib/email'

/**
 * Test endpoint for email sending
 * This is for development/testing only
 *
 * Usage:
 * POST /api/email/test
 * {
 *   "testEmail": "your-email@example.com",
 *   "template": "notification" // or "timesheet-approval", "timesheet-reminder", "leave-approval", "password-reset", "welcome"
 * }
 */
export async function POST(req: Request) {
  try {
    const { testEmail, template = 'notification' } = await req.json()

    if (!testEmail) {
      return NextResponse.json(
        { success: false, error: 'testEmail is required' },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'RESEND_API_KEY not configured in .env' },
        { status: 500 }
      )
    }

    let result

    switch (template) {
      case 'notification':
        result = await sendNotificationEmail(
          testEmail,
          'Test Notification',
          'This is a test notification from DSN RMO. If you can see this, your email setup is working correctly!',
          'https://dsnrmo.com',
          'Visit Website'
        )
        break

      case 'timesheet-approval':
        result = await sendTimesheetApprovalEmail(
          testEmail,
          'John Doe',
          '2026-03-24',
          'approved',
          'Great work this week! All entries look good.',
          'https://dsnrmo.com/timesheet'
        )
        break

      case 'timesheet-reminder':
        result = await sendTimesheetReminderEmail(
          testEmail,
          'John Doe',
          '2026-03-24',
          'Friday, March 28, 2026 at 5:00 PM',
          'https://rmo.dsnsandbox.com/timesheet'
        )
        break


      case 'password-reset':
        result = await sendPasswordResetEmail(
          testEmail,
          'John Doe',
          'https://rmo.dsnsandbox.com/reset-password?token=sample-reset-token-123',
          '1 hour'
        )
        break

      case 'welcome':
        result = await sendWelcomeEmail(
          testEmail,
          'John Doe',
          testEmail,
          'https://rmo.dsnsandbox.com/login'
        )
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid template type' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
