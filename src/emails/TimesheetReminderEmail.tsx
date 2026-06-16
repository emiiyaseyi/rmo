import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface TimesheetReminderEmailProps {
  staffName: string
  weekKey: string
  deadline: string
  actionUrl?: string
}

export const TimesheetReminderEmail = ({
  staffName,
  weekKey,
  deadline,
  actionUrl,
}: TimesheetReminderEmailProps) => {
  return (
    <BaseEmail
      preview={`Reminder: Submit your timesheet for week ${weekKey}`}
      heading="Timesheet Submission Reminder ⏰"
    >
      <Text style={text}>Hi {staffName},</Text>

      <Text style={text}>
        This is a friendly reminder to submit your timesheet for the week of{' '}
        <strong>{weekKey}</strong>.
      </Text>

      <div style={deadlineBox}>
        <Text style={deadlineText}>
          <strong>Deadline:</strong> {deadline}
        </Text>
      </div>

      <Text style={text}>
        Please ensure you submit your timesheet before the deadline to avoid any late penalties.
      </Text>

      {actionUrl && (
        <div style={buttonContainer}>
          <Button style={button} href={actionUrl}>
            Submit Timesheet
          </Button>
        </div>
      )}
    </BaseEmail>
  )
}

// Styles
const text = {
  color: '#000000',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const deadlineBox = {
  backgroundColor: '#FEF3C7',
  border: '1px solid #E0A12B',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const deadlineText = {
  color: '#92400E',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '16px 0',
}

const button = {
  backgroundColor: '#0C7A37',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

export default TimesheetReminderEmail
