import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

const STEPS = [
  {
    title: 'Welcome to DSN Resource Management! 👋',
    desc: 'This quick tour will show you how to use the system. It only takes 60 seconds.',
    icon: '🎉',
  },
  {
    title: 'Log Your Hours',
    desc: 'Go to "Timesheet" in the sidebar to log your daily work entries. Add a project, description, hours, and category for each entry.',
    icon: '📋',
    nav: 'timesheet',
  },
  {
    title: 'Submit by Tuesday 4pm WAT',
    desc: 'The submission window opens Monday 8am and closes Tuesday 4pm WAT. Hit "Submit Week" when all your entries are ready.',
    icon: '⏰',
  },
  {
    title: 'Track Approvals',
    desc: 'After submitting, your lead reviews and approves each entry. You\'ll get a notification when done. Rejected entries can be resubmitted.',
    icon: '✅',
  },
  {
    title: 'Earn Points & Badges',
    desc: 'You earn points for submitting on time, getting approved, and maintaining streaks. Check the Leaderboard to see your rank!',
    icon: '🏆',
    nav: 'leaderboard',
  },
  {
    title: 'Messages',
    desc: 'Use the Messages section to communicate directly with your lead or team. Group channels are available for announcements.',
    icon: '💬',
    nav: 'messages',
  },
  {
    title: 'You\'re all set! 🚀',
    desc: 'Your profile, settings, and help docs are always available in the sidebar. Good luck and remember — submit by Tuesday 4pm!',
    icon: '🚀',
  },
]

export default function WalkthroughTour({ setPage }) {
  const { updateUser } = useApp()
  const [step, setStep] = useState(0)

  function finish() {
    updateUser({ tour_done: true })
  }

  function goNext() {
    const next = STEPS[step + 1]
    if (next?.nav) setPage(next.nav)
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      finish()
    }
  }

  const current = STEPS[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9000, padding: 20
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 32, maxWidth: 480, width: '100%',
        textAlign: 'center',
        animation: 'slideUp 0.3s'
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              background: i === step ? 'var(--accent)' : i < step ? 'var(--success)' : 'var(--border)',
              width: i === step ? 24 : 8,
              transition: 'all 0.3s'
            }} />
          ))}
        </div>

        <div style={{ fontSize: 56, marginBottom: 16 }}>{current.icon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{current.title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>{current.desc}</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          <button className="btn btn-primary" onClick={goNext}>
            {step === STEPS.length - 1 ? '🚀 Get Started' : 'Next →'}
          </button>
          {step < STEPS.length - 1 && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={finish}>Skip tour</button>
          )}
        </div>
      </div>
    </div>
  )
}
