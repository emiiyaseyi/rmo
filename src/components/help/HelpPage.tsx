'use client'
import React, { useState } from 'react'
import { local } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function HelpPage() {
  const [openId, setOpenId] = useState(null)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const faqItems = local.get('faq_items', DEFAULT_FAQ)

  function handleForgot(e) {
    e.preventDefault()
    if (!email) return
    const reqs = local.get('pin_reset_requests', [])
    if (!reqs.find(r => r.email === email && r.status === 'pending')) {
      reqs.push({ email, timestamp: new Date().toISOString(), status: 'pending' })
      local.set('pin_reset_requests', reqs)
    }
    setSent(true)
    toast.success('Reset request sent to admin!')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>❓ Help & FAQ</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Quick answers to common questions</p>
      </div>

      {/* Forgot PIN card */}
      <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: 1.5 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🔐 Forgot your PIN?</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
          Enter your email below and your admin will be notified to reset your PIN.
        </p>
        {!sent ? (
          <form onSubmit={handleForgot} style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-input"
              type="email"
              placeholder="you@datasciencenigeria.ai"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit">Send Request</button>
          </form>
        ) : (
          <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            ✅ Request sent! Your admin will reset your PIN shortly.
          </div>
        )}
      </div>

      {/* FAQ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {faqItems.map((item, i) => (
          <div
            key={item.id || i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--bg-card)',
            }}
          >
            <button
              onClick={() => setOpenId(openId === (item.id || i) ? null : (item.id || i))}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 18px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, color: 'var(--text-1)',
              }}
            >
              <span>{item.q}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 18, transition: 'transform 0.2s', transform: openId === (item.id || i) ? 'rotate(45deg)' : 'rotate(0)' }}>+</span>
            </button>
            {openId === (item.id || i) && (
              <div style={{
                padding: '0 18px 16px',
                fontSize: 13, color: 'var(--text-2)',
                lineHeight: 1.7,
                borderTop: '1px solid var(--border)',
                paddingTop: 14,
              }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="card" style={{ background: 'var(--bg-elevated)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Still need help?</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
          Contact your system admin or send a message via the Messages tab.
        </p>
      </div>
    </div>
  )
}

const DEFAULT_FAQ = [
  { id: '1', q: 'When can I submit my timesheet?', a: 'The submission window opens every Monday at 8:00am WAT and closes Tuesday at 4:00pm WAT. You can see a live countdown on your dashboard.' },
  { id: '2', q: 'What happens if I exceed the 45-hour weekly cap?', a: 'You will not be able to submit your timesheet if your total hours exceed 45h. You must reduce your logged hours before submitting.' },
  { id: '3', q: 'How do I resubmit a rejected entry?', a: 'Go to Timesheet, find the rejected entry (marked in red), and click "Resubmit". You can add a note explaining changes made.' },
  { id: '4', q: 'What are points and how do I earn them?', a: 'Points are awarded for on-time submissions, approved entries, and maintaining streaks. They are used to rank on the leaderboard and redeem rewards in the Points Shop.' },
  { id: '5', q: 'How do I request leave?', a: 'Go to My Profile → Leave tab and submit a leave request with your dates and reason. Your admin will be notified and will approve or reject it.' },
  { id: '6', q: 'Can I submit if I had no work this week?', a: 'Yes! On the Timesheet page, click "No Work This Week" button to submit a zero-hours record and avoid breaking your streak.' },
  { id: '7', q: 'How do I change my PIN?', a: 'Go to My Profile → Change PIN tab. You will need your current PIN to set a new one.' },
  { id: '8', q: 'How do I duplicate a previous entry?', a: 'On the Timesheet page, click the copy icon next to any entry. A duplicate will be created with today\'s date that you can then edit.' },
]
