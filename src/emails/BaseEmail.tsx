import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface BaseEmailProps {
  preview: string
  heading: string
  children: React.ReactNode
}

export const BaseEmail = ({ preview, heading, children }: BaseEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with DSN RMO Branding */}
          <Section style={header}>
            <Img
              src={process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dsn.png` : 'https://rmo.dsnsandbox.com/dsn.png'}
              alt="DSN - Data Scientists Network"
              width="180"
              height="auto"
              style={logoImg}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated notification from DSN RMO (Data Science Nigeria Resource Management Office).
            </Text>
            <Text style={footerText}>
              If you have any questions, please contact your administrator.
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} DSN RMO. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#EEF2F6',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Poppins", "Helvetica Neue", Arial, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
}

const header = {
  backgroundColor: '#ffffff',
  padding: '24px 40px',
  textAlign: 'center' as const,
  borderBottom: '3px solid #076C04',
}

const logoImg = {
  margin: '0 auto',
  display: 'block',
}

const content = {
  padding: '40px',
}

const h1 = {
  color: '#000000',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px',
}

const hr = {
  borderColor: '#D8DEE4',
  margin: '0',
}

const footer = {
  padding: '24px 40px',
  backgroundColor: '#F0FDF4',
}

const footerText = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const footerCopyright = {
  color: '#999999',
  fontSize: '11px',
  margin: '16px 0 0',
}

export default BaseEmail
