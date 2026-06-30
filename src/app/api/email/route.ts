import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Lazy-init: constructing Resend at module load throws when the key is absent
// (e.g. during `next build` page-data collection). Defer until first send.
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

// Rate limiting: max 3 emails per recipient per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

function isRateLimited(email: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(email)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'DSN RMO <noreply@rmo.dsnsandbox.com>'

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

    const recipient = Array.isArray(to) ? to[0] : to
    if (isRateLimited(recipient)) {
      console.warn(`Rate limit hit for ${recipient} — email suppressed`)
      return NextResponse.json({ success: false, message: 'Rate limit exceeded' }, { status: 429 })
    }

    // Send email using Resend
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || text,
      text,
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
