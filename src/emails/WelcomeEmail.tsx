import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmail } from './BaseEmail'

interface WelcomeEmailProps {
  staffName: string
  email: string
  loginUrl?: string
}

export const WelcomeEmail = ({ staffName, email, loginUrl }: WelcomeEmailProps) => {
  return (
    <BaseEmail preview="Welcome to DSN RMO" heading="Welcome to DSN RMO! 🎉">
      <Text style={text}>Hi {staffName},</Text>

      <Text style={text}>
        Welcome to the Data Science Nigeria Resource Management Office platform!
      </Text>

      <Text style={text}>
        Your account has been created successfully. Here are your account details:
      </Text>

      <div style={detailsBox}>
        <Text style={detailsText}>
          <strong>Email:</strong> {email}
        </Text>
        <Text style={detailsText}>
          <strong>Default Password:</strong> dsn-stff
        </Text>
        <Text style={detailsText}>
          <strong>Account Type:</strong> Staff Member
        </Text>
      </div>

      <div style={warningBox}>
        <Text style={warningText}>
          <strong>Important:</strong> Please change your password after your first login for security purposes.
        </Text>
      </div>

      <Text style={text}>
        You can now access the platform to:
      </Text>

      <ul style={list}>
        <li style={listItem}>Submit and manage your timesheets</li>
        <li style={listItem}>Request and track leave</li>
        <li style={listItem}>View your performance analytics</li>
        <li style={listItem}>Track your points and achievements</li>
      </ul>

      <div style={buttonContainer}>
        <Button style={button} href={loginUrl || 'https://rmo.dsnsandbox.com'}>
          Log In to Your Account
        </Button>
      </div>

      <Text style={text}>
        If you have any questions or need assistance, please don't hesitate to contact your
        administrator.
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

const list = {
  margin: '0 0 16px',
  paddingLeft: '24px',
}

const listItem = {
  color: '#000000',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '4px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
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

export default WelcomeEmail
