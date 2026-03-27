import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface TimesheetApprovalEmailProps {
  staffName: string
  weekKey: string
  status: 'approved' | 'rejected'
  message?: string
  actionUrl?: string
}

export const TimesheetApprovalEmail = ({
  staffName,
  weekKey,
  status,
  message,
  actionUrl,
}: TimesheetApprovalEmailProps) => {
  const isApproved = status === 'approved'
  const title = isApproved
    ? 'Timesheet Approved ✅'
    : 'Timesheet Requires Revision ⚠️'

  return (
    <BaseEmail preview={`Timesheet ${status} for week ${weekKey}`} heading={title}>
      <Text style={text}>Hi {staffName},</Text>

      <Text style={text}>
        Your timesheet for the week of <strong>{weekKey}</strong> has been{' '}
        <span style={isApproved ? statusApproved : statusRejected}>
          {status.toUpperCase()}
        </span>
        .
      </Text>

      {message && (
        <div style={messageBox}>
          <Text style={messageText}>
            <strong>Feedback:</strong> {message}
          </Text>
        </div>
      )}

      {!isApproved && (
        <Text style={text}>
          Please review the feedback and make the necessary corrections to your timesheet.
        </Text>
      )}

      {actionUrl && (
        <div style={buttonContainer}>
          <Button style={button} href={actionUrl}>
            View Timesheet
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

const statusApproved = {
  color: '#22C55E',
  fontWeight: '700',
}

const statusRejected = {
  color: '#D8001A',
  fontWeight: '700',
}

const messageBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid #D8DEE4',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const messageText = {
  color: '#000000',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '16px 0',
}

const button = {
  backgroundColor: '#076C04',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

export default TimesheetApprovalEmail
