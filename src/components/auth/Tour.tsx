'use client'
import React, { useState } from 'react'
import { local } from '../../lib/utils'

const STEPS = [
  { title: 'Welcome to DSN RMS! 👋', desc: 'This quick tour will show you the key features of your Resource Management System. It only takes 60 seconds!', icon: '🎉' },
  { title: 'Dashboard', desc: 'Your home base. See the live submission countdown, your weekly hours at a glance, and recent activity. The countdown tells you exactly how long you have to submit.', icon: '🏠' },
  { title: 'Timesheet', desc: 'Log your hours here. Add entries with project, description, hours and category. Once you\'re done for the week, hit "Submit Week" during the Mon–Tue window.', icon: '📋' },
  { title: 'Approvals (Leads/Admins)', desc: 'If you\'re a team lead or admin, this is where you review submissions. You can approve, reject with a reason, request clarification, or correct hours directly.', icon: '✅' },
  { title: 'Leaderboard & Points', desc: 'Earn points for on-time submissions, approved entries, and streaks. Redeem points in the Points Shop. Climb the leaderboard and earn badges!', icon: '🏆' },
  { title: 'Messages', desc: 'Send direct messages to any team member, or post to the All Staff channel. Check for notifications using the bell icon in the top bar.', icon: '💬' },
  { title: 'You\'re all set! 🚀', desc: 'Head to your Timesheet to log your first entry. If you ever need help, check the Help & FAQ page. Good luck!', icon: '🚀' },
]

interface TourProps {
  onComplete: () => void;
}

export default function Tour({ onComplete }: TourProps) {
  const [step, setStep] = useState(0)
  const [animating, setAnimating] = useState(false)

  function next() {
    if (step < STEPS.length - 1) {
      setAnimating(true)
      setTimeout(() => { setStep(s => s + 1); setAnimating(false) }, 150)
    } else {
      finish()
    }
  }

  function prev() {
    if (step > 0) {
      setAnimating(true)
      setTimeout(() => { setStep(s => s - 1); setAnimating(false) }, 150)
    }
  }

  function finish() {
    local.set('tour_completed', true)
    onComplete()
  }

  const current = STEPS[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9000, padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 440,
        padding: 32, textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        opacity: animating ? 0 : 1, transform: animating ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 0.15s',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                height: 6, borderRadius: 3,
                width: i === step ? 24 : 6,
                background: i === step ? 'var(--accent)' : i < step ? 'var(--success)' : 'var(--border)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ fontSize: 52, marginBottom: 16 }}>{current.icon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{current.title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
          {current.desc}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {step > 0 && (
            <button className="btn btn-secondary" onClick={prev}>← Back</button>
          )}
          <button className="btn btn-primary" style={{ minWidth: 120 }} onClick={next}>
            {step === STEPS.length - 1 ? 'Get Started! 🚀' : 'Next →'}
          </button>
        </div>

        {/* Skip */}
        {step < STEPS.length - 1 && (
          <button
            onClick={finish}
            style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}
          >
            Skip tour
          </button>
        )}

        {/* Step indicator text */}
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-3)' }}>
          Step {step + 1} of {STEPS.length}
        </div>
      </div>
    </div>
  )
}
