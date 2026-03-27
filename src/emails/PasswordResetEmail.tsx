import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface PasswordResetEmailProps {
  staffName: string
  resetUrl: string
  expiresIn?: string
}

export const PasswordResetEmail = ({
  staffName,
  resetUrl,
  expiresIn = '1 hour',
}: PasswordResetEmailProps) => {
  return (
    <BaseEmail
      preview="Reset your password"
      heading="Password Reset Request 🔐"
    >
      <Text style={text}>Hi {staffName},</Text>

      <Text style={text}>
        We received a request to reset your password for your DSN RMO account.
      </Text>

      <Text style={text}>Click the button below to reset your password:</Text>

      <div style={buttonContainer}>
        <Button style={button} href={resetUrl}>
          Reset Password
        </Button>
      </div>

      <div style={warningBox}>
        <Text style={warningText}>
          This link will expire in <strong>{expiresIn}</strong>.
        </Text>
      </div>

      <Text style={text}>
        If you didn't request a password reset, you can safely ignore this email. Your
        password will remain unchanged.
      </Text>

      <Text style={smallText}>
        If the button doesn't work, copy and paste this link into your browser:
        <br />
        <a href={resetUrl} style={linkStyle}>
          {resetUrl}
        </a>
      </Text>
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

const warningBox = {
  backgroundColor: '#FEF3C7',
  border: '1px solid #EAB308',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const warningText = {
  color: '#92400E',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
}

const smallText = {
  color: '#666666',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '16px 0 0',
}

const linkStyle = {
  color: '#076C04',
  wordBreak: 'break-all' as const,
}

export default PasswordResetEmail
