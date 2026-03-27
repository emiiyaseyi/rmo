import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface NotificationEmailProps {
  title: string
  message: string
  actionUrl?: string
  actionText?: string
}

export const NotificationEmail = ({
  title,
  message,
  actionUrl,
  actionText = 'View Details',
}: NotificationEmailProps) => {
  return (
    <BaseEmail preview={title} heading={title}>
      <Text style={text}>{message}</Text>

      {actionUrl && (
        <div style={buttonContainer}>
          <Button style={button} href={actionUrl}>
            {actionText}
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
  margin: '0 0 24px',
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

export default NotificationEmail
