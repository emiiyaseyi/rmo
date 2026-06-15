import { Button, Text, Hr } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface WeeklyReminderEmailProps {
  staffName: string
  deadline: string       // e.g. "12:00 noon today, Monday, 8th June 2026"
  isLastReminder?: boolean
  actionUrl?: string
}

export const WeeklyReminderEmail = ({
  staffName,
  deadline,
  isLastReminder = false,
  actionUrl = 'http://rmo.dsnsandbox.com',
}: WeeklyReminderEmailProps) => {
  return (
    <BaseEmail
      preview={isLastReminder ? `Last reminder: Submit your weekly deliverables before ${deadline}` : 'Weekly Deliverables Reminder – Action Required'}
      heading={isLastReminder ? '⏰ Last Reminder: Weekly Deliverables' : '📋 Weekly Deliverables Reminder'}
    >
      <Text style={text}>Dear {staffName},</Text>

      {!isLastReminder && (
        <>
          <Text style={text}>
            As we begin the week, this is a gentle reminder regarding the <strong>Weekly Deliverables</strong> process.
          </Text>
          <Text style={text}>
            Please note that this is <strong>important and mandatory for all staff</strong>, as it supports effective coordination, accountability, and accurate tracking of team progress.
          </Text>
          <Text style={text}>
            Kindly use the updated link below to access the RMO platform:
          </Text>
        </>
      )}

      {isLastReminder && (
        <Text style={text}>
          This is your <strong>last reminder</strong> to complete and submit your Weekly Deliverables before the deadline.
        </Text>
      )}

      <div style={linkBox}>
        <Text style={linkLabel}>RMO Website:</Text>
        <Text style={linkText}>
          <a href={actionUrl} style={linkAnchor}>{actionUrl}</a>
        </Text>
      </div>

      {!isLastReminder && (
        <Text style={text}>
          Before completing the form, please ensure you liaise with your respective project or task owners to confirm your assigned tasks and expected hours, as previously communicated. This will help maintain proper alignment, clarity, timely, and accurate reporting.
        </Text>
      )}

      <div style={deadlineBox}>
        <Text style={deadlineText}>
          ⏰ All staff are expected to complete and submit on or before <strong>{deadline}</strong>.
        </Text>
      </div>

      <Text style={text}>
        Timely submission remains important for effective coordination, accountability, and progress tracking across teams.
      </Text>

      <Hr style={{ borderColor: '#e5e7eb', margin: '20px 0' }} />

      <Text style={footer}>
        Thank you for your continued cooperation and commitment.
      </Text>

      <div style={buttonContainer}>
        <Button style={button} href={actionUrl}>
          Submit Weekly Deliverables
        </Button>
      </div>
    </BaseEmail>
  )
}

const text = {
  color: '#111827',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 14px',
}

const linkBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid #16A34A',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '16px 0',
}

const linkLabel = {
  color: '#374151',
  fontSize: '12px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 4px',
}

const linkText = {
  margin: '0',
  fontSize: '15px',
}

const linkAnchor = {
  color: '#076C04',
  fontWeight: '600' as const,
}

const deadlineBox = {
  backgroundColor: '#FEF3C7',
  border: '1px solid #EAB308',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '16px 0',
}

const deadlineText = {
  color: '#92400E',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
}

const footer = {
  color: '#6B7280',
  fontSize: '14px',
  margin: '0 0 16px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '20px 0',
}

const button = {
  backgroundColor: '#076C04',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block' as const,
  padding: '12px 28px',
}

export default WeeklyReminderEmail
