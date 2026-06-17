import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface ReviewWindowEmailProps {
  leadName: string
  weekKey: string
  reviewDeadline: string
  pendingCount: number
  actionUrl?: string
}

export const ReviewWindowEmail = ({
  leadName,
  weekKey,
  reviewDeadline,
  pendingCount,
  actionUrl,
}: ReviewWindowEmailProps) => {
  return (
    <BaseEmail
      preview={`Action required: Review ${pendingCount} timesheet${pendingCount !== 1 ? 's' : ''} by ${reviewDeadline}`}
      heading="Timesheet Review Window Open 📋"
    >
      <Text style={text}>Hi {leadName},</Text>

      <Text style={text}>
        The submission window for week <strong>{weekKey}</strong> has closed.
        You have <strong>24 hours</strong> to review and approve the timesheets
        assigned to you.
      </Text>

      <div style={alertBox}>
        <Text style={alertText}>
          ⏰ <strong>Review Deadline:</strong> {reviewDeadline}
        </Text>
        <Text style={alertText}>
          📝 <strong>Pending entries:</strong> {pendingCount} timesheet{pendingCount !== 1 ? 's' : ''} awaiting review
        </Text>
      </div>

      <Text style={text}>
        Reviews submitted after the deadline will incur a <strong>point deduction</strong>.
        Please complete your reviews promptly to maintain your score.
      </Text>

      {actionUrl && (
        <div style={buttonContainer}>
          <Button style={button} href={actionUrl}>
            Start Reviewing
          </Button>
        </div>
      )}

      <Text style={footer}>
        This is an automated reminder from DSN RMO. Late reviews affect your performance score.
      </Text>
    </BaseEmail>
  )
}

const text = {
  color: '#000000',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const alertBox = {
  backgroundColor: '#FEF3C7',
  border: '1px solid #E0A12B',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const alertText = {
  color: '#92400E',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 6px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
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

const footer = {
  color: '#6B7280',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '16px 0 0',
}

export default ReviewWindowEmail
