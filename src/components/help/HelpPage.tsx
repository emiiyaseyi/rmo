'use client'
import React, { useState } from 'react'
import { local } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Search, HelpCircle, MessageSquare } from 'lucide-react'

export default function HelpPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [search, setSearch] = useState('')
  const [showContact, setShowContact] = useState(false)
  const faqItems = local.get('faq_items', DEFAULT_FAQ)

  const filteredFaqs = faqItems.filter((f: any) =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  )

  function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    const reqs = local.get<any[]>('pin_reset_requests', [])
    if (!reqs.find((r: any) => r.email === email && r.status === 'pending')) {
      reqs.push({ email, timestamp: new Date().toISOString(), status: 'pending' })
      local.set('pin_reset_requests', reqs)
    }
    setSent(true)
    toast.success('Reset request sent to admin!')
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(150deg, var(--brand-2), var(--brand))', borderRadius: 'var(--r-lg)', padding: 34, color: '#fff', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 1px 1px,#fff 1.5px,transparent 0)', backgroundSize: '24px 24px' }} />
        <div style={{ position: 'relative' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>How can we help?</h1>
          <p style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>Answers to the most common RMO questions</p>
          <div style={{ position: 'relative', maxWidth: 440, margin: '18px auto 0' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', display: 'flex' }}><Search size={17} /></span>
            <input
              placeholder="Search help articles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 40px', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)', background: '#fff', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* FAQ grid */}
      {filteredFaqs.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>No matching help articles found</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Try simpler keywords like "PIN" or "hours"</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {filteredFaqs.map((f: any, i: number) => (
            <div key={f.id || i} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--tint)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><HelpCircle size={14} /></span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{f.q}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, paddingLeft: 36 }}>{f.a}</div>
            </div>
          ))}
        </div>
      )}

      {/* Contact / reset */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--tint)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageSquare size={22} /></div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Still need a hand?</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Forgot your PIN or have an issue? Notify an admin — we usually reply within a few hours.</div>
          </div>
        </div>
        {!showContact && !sent && (
          <button onClick={() => setShowContact(true)} style={brandBtn}>Contact support</button>
        )}
        {showContact && !sent && (
          <form onSubmit={handleForgot} style={{ display: 'flex', gap: 10, flex: 1, minWidth: 280 }}>
            <input type="email" required placeholder="you@datasciencenigeria.ai" value={email} onChange={e => setEmail(e.target.value)}
              style={{ flex: 1, padding: '10px 13px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)', outline: 'none' }} />
            <button type="submit" style={brandBtn}>Send request</button>
          </form>
        )}
        {sent && (
          <span style={{ background: 'var(--tint)', color: 'var(--brand-2)', padding: '10px 14px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600 }}>✅ Request sent — admin notified</span>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--sh-sm)'
}
const brandBtn: React.CSSProperties = {
  padding: '11px 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)',
  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(12,122,55,.25)', whiteSpace: 'nowrap'
}

const DEFAULT_FAQ = [
  { id: '1', q: 'When can I submit my timesheet?', a: 'The submission window opens every Monday at 8:00am WAT and closes Tuesday at 4:00pm WAT. You can see a live countdown on your dashboard.' },
  { id: '2', q: 'What happens if I exceed the weekly hour cap?', a: 'You will not be able to submit your timesheet if your total hours exceed the configured cap. Reduce your logged hours before submitting.' },
  { id: '3', q: 'How do I resubmit a rejected entry?', a: 'Go to Timesheet, find the rejected entry (marked in red), and click "Resubmit". You can add a note explaining changes made.' },
  { id: '4', q: 'What are points and how do I earn them?', a: 'Points are awarded for on-time submissions and maintaining streaks. They rank you on the leaderboard and can be redeemed for rewards in the Points Shop.' },
  { id: '5', q: 'How do I request leave?', a: 'Go to Leave & Absence and log your leave with dates and reason. While on approved leave you will not be flagged as non-compliant.' },
  { id: '6', q: 'Can I submit if I had no work this week?', a: 'Yes — on the Timesheet page click "No Work This Week" to submit a zero-hours record and keep your streak alive.' },
  { id: '7', q: 'How do I change my PIN?', a: 'Go to My Profile → Change PIN. You will need your current PIN to set a new one.' },
  { id: '8', q: 'How do I duplicate a previous entry?', a: 'On the Timesheet page, click the copy icon next to any entry. A duplicate is created with today\'s date that you can edit.' },
]
