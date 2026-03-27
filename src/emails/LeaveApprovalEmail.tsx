import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface LeaveApprovalEmailProps {
  staffName: string
  leaveType: string
  startDate: string
  endDate: string
  status: 'approved' | 'rejected'
  message?: string
  actionUrl?: string
}

export const LeaveApprovalEmail = ({
  staffName,
  leaveType,
  startDate,
  endDate,
  status,
  message,
  actionUrl,
}: LeaveApprovalEmailProps) => {
  const isApproved = status === 'approved'
  const title = isApproved ? 'Leave Request Approved ✅' : 'Leave Request Denied ⚠️'

  return (
    <BaseEmail preview={`Leave request ${status}`} heading={title}>
      <Text style={text}>Hi {staffName},</Text>

      <Text style={text}>
        Your leave request has been{' '}
        <span style={isApproved ? statusApproved : statusRejected}>
          {status.toUpperCase()}
        </span>
        .
      </Text>

      <div style={detailsBox}>
        <Text style={detailsText}>
          <strong>Leave Type:</strong> {leaveType}
        </Text>
        <Text style={detailsText}>
          <strong>Start Date:</strong> {startDate}
        </Text>
        <Text style={detailsText}>
          <strong>End Date:</strong> {endDate}
        </Text>
      </div>

      {message && (
        <div style={messageBox}>
          <Text style={messageText}>
            <strong>Comments:</strong> {message}
          </Text>
        </div>
      )}

      {actionUrl && (
        <div style={buttonContainer}>
          <Button style={button} href={actionUrl}>
            View Leave Details
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

const detailsBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid #D8DEE4',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const detailsText = {
  color: '#000000',
  fontSize: '14px',
  lineHeight: '1.8',
  margin: '0',
}

const messageBox = {
  backgroundColor: '#FEF3C7',
  border: '1px solid #EAB308',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const messageText = {
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

export default LeaveApprovalEmail
