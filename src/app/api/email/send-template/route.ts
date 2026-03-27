import { NextResponse } from 'next/server'
import {
  sendNotificationEmail,
  sendTimesheetApprovalEmail,
  sendTimesheetReminderEmail,
  sendLeaveApprovalEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '@/lib/email'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, to, ...params } = body

    if (!process.env.RESEND_API_KEY) {
      console.warn('Resend API key not configured. Please set RESEND_API_KEY in .env')
      return NextResponse.json(
        { success: false, message: 'Resend API key missing' },
        { status: 500 }
      )
    }

    let result

    switch (type) {
      case 'notification':
        result = await sendNotificationEmail(
          to,
          params.title,
          params.message,
          params.actionUrl,
          params.actionText
        )
        break

      case 'timesheet-approval':
        result = await sendTimesheetApprovalEmail(
          to,
          params.staffName,
          params.weekKey,
          params.status,
          params.message,
          params.actionUrl
        )
        break

      case 'timesheet-reminder':
        result = await sendTimesheetReminderEmail(
          to,
          params.staffName,
          params.weekKey,
          params.deadline,
          params.actionUrl
        )
        break

      case 'leave-approval':
        result = await sendLeaveApprovalEmail(
          to,
          params.staffName,
          params.leaveType,
          params.startDate,
          params.endDate,
          params.status,
          params.message,
          params.actionUrl
        )
        break

      case 'password-reset':
        result = await sendPasswordResetEmail(
          to,
          params.staffName,
          params.resetUrl,
          params.expiresIn
        )
        break

      case 'welcome':
        result = await sendWelcomeEmail(
          to,
          params.staffName,
          params.email,
          params.loginUrl
        )
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid email type' },
          { status: 400 }
        )
    }

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error sending template email:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
