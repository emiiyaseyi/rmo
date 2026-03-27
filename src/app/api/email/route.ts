import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { to, subject, text, html } = await req.json()

    if (!process.env.RESEND_API_KEY) {
      console.warn('Resend API key not configured. Please set RESEND_API_KEY in .env')
      return NextResponse.json(
        { success: false, message: 'Resend API key missing' },
        { status: 500 }
      )
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: process.env.SMTP_FROM
        ? `${process.env.SMTP_FROM} <noreply@rmo.dsnsandbox.com>`
        : 'DSN RMO <noreply@rmo.dsnsandbox.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || text, // Use HTML if provided, otherwise fall back to text
      text, // Include text version for email clients that prefer it
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('Email sent via Resend:', data)

    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
