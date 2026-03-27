import { Resend } from 'resend'
import { render } from '@react-email/components'
import { NotificationEmail } from '@/emails/NotificationEmail'
import { TimesheetApprovalEmail } from '@/emails/TimesheetApprovalEmail'
import { TimesheetReminderEmail } from '@/emails/TimesheetReminderEmail'
import { LeaveApprovalEmail } from '@/emails/LeaveApprovalEmail'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'
import { WelcomeEmail } from '@/emails/WelcomeEmail'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string | string[]
  subject: string
  from?: string
}

// Base email sending function
export async function sendEmail(options: EmailOptions, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || 'DSN RMO <noreply@rmo.dsnsandbox.com>',
      to: options.to,
      subject: options.subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    console.log('Email sent successfully:', data)
    return { success: true, data }
  } catch (error: any) {
    console.error('Failed to send email:', error)
    return { success: false, error: error.message }
  }
}

// Generic notification email
export async function sendNotificationEmail(
  to: string | string[],
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string
) {
  const html = await render(
    NotificationEmail({ title, message, actionUrl, actionText })
  )

  return sendEmail(
    {
      to,
      subject: title,
    },
    html
  )
}

// Timesheet approval email
export async function sendTimesheetApprovalEmail(
  to: string | string[],
  staffName: string,
  weekKey: string,
  status: 'approved' | 'rejected',
  message?: string,
  actionUrl?: string
) {
  const html = await render(
    TimesheetApprovalEmail({ staffName, weekKey, status, message, actionUrl })
  )

  const subject =
    status === 'approved'
      ? `Timesheet Approved for ${weekKey}`
      : `Timesheet Requires Revision - ${weekKey}`

  return sendEmail({ to, subject }, html)
}

// Timesheet reminder email
export async function sendTimesheetReminderEmail(
  to: string | string[],
  staffName: string,
  weekKey: string,
  deadline: string,
  actionUrl?: string
) {
  const html = await render(
    TimesheetReminderEmail({ staffName, weekKey, deadline, actionUrl })
  )

  return sendEmail(
    {
      to,
      subject: `Reminder: Submit your timesheet for ${weekKey}`,
    },
    html
  )
}

// Leave approval email
export async function sendLeaveApprovalEmail(
  to: string | string[],
  staffName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  status: 'approved' | 'rejected',
  message?: string,
  actionUrl?: string
) {
  const html = await render(
    LeaveApprovalEmail({
      staffName,
      leaveType,
      startDate,
      endDate,
      status,
      message,
      actionUrl,
    })
  )

  const subject =
    status === 'approved'
      ? 'Leave Request Approved'
      : 'Leave Request Denied'

  return sendEmail({ to, subject }, html)
}

// Password reset email
export async function sendPasswordResetEmail(
  to: string | string[],
  staffName: string,
  resetUrl: string,
  expiresIn?: string
) {
  const html = await render(
    PasswordResetEmail({ staffName, resetUrl, expiresIn })
  )

  return sendEmail(
    {
      to,
      subject: 'Password Reset Request - DSN RMO',
    },
    html
  )
}

// Welcome email
export async function sendWelcomeEmail(
  to: string | string[],
  staffName: string,
  email: string,
  loginUrl?: string
) {
  const html = await render(
    WelcomeEmail({ staffName, email, loginUrl })
  )

  return sendEmail(
    {
      to,
      subject: 'Welcome to DSN RMO!',
    },
    html
  )
}

// Legacy support: Send email with custom HTML (for backward compatibility)
export async function sendCustomEmail(
  to: string | string[],
  subject: string,
  html: string
) {
  return sendEmail({ to, subject }, html)
}
