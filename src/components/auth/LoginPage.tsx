'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { local, logAudit, genId } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Staff } from '../../types'

export default function LoginPage() {
  const { staff, login, settings } = useApp()
  const [step, setStep] = useState<'email' | 'pin' | 'change_pin' | 'forgot'>('email')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [foundUser, setFoundUser] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'pin') pinRef.current?.focus()
  }, [step])

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const found = staff.find(s => s.email?.toLowerCase() === email.toLowerCase().trim())
    if (!found) { setError('No account found with this email.'); return }
    if (found.suspended) { setError('Your account is suspended. Contact admin.'); return }

    // Check lockout
    const lockoutKey = `lockout_${found.id}`
    const lockout = local.get<{ until: number } | null>(lockoutKey, null)
    if (lockout && Date.now() < lockout.until) {
      const mins = Math.ceil((lockout.until - Date.now()) / 60000)
      setError(`Account locked. Try again in ${mins} minute(s).`)
      return
    }

    setFoundUser(found)
    setStep('pin')
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!foundUser) return
    setError('')
    setLoading(true)

    setTimeout(() => {
      if (!foundUser) return
      const lockoutKey = `lockout_${foundUser.id}`
      const attemptsKey = `attempts_${foundUser.id}`

      if (pin !== foundUser.pin) {
        const attempts = (local.get<number>(attemptsKey, 0)) + 1
        local.set(attemptsKey, attempts)

        if (attempts >= 5) {
          local.set(lockoutKey, { until: Date.now() + 30 * 60 * 1000 })
          local.remove(attemptsKey)
          setError('Too many failed attempts. Account locked for 30 minutes.')
          logAudit('LOCKOUT', `${foundUser.name} locked out`, foundUser.id, foundUser.name)
        } else {
          setError(`Incorrect PIN. ${5 - attempts} attempt(s) remaining.`)
        }
        setLoading(false)
        setPin('')
        return
      }

      // Correct PIN — clear lockout
      local.remove(lockoutKey)
      local.remove(`attempts_${foundUser.id}`)

      if (foundUser.first_login) {
        setStep('change_pin')
      } else {
        login(foundUser)
      }
      setLoading(false)
    }, 400)
  }

  function handleChangePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!foundUser) return
    setError('')
    if (newPin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return }
    if (newPin === foundUser.pin) { setError('New PIN must be different from current PIN.'); return }

    const updatedUser: Staff = { ...foundUser, pin: newPin, first_login: false }
    sessionStorage.setItem('dsn_pin_change', JSON.stringify(updatedUser))
    login(updatedUser)
    toast.success('PIN updated! Welcome to DSN RMS.')
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setForgotSent(true)
    const reqs = local.get<any[]>('pin_reset_requests', [])
    reqs.push({ email, timestamp: new Date().toISOString(), status: 'pending' })
    local.set('pin_reset_requests', reqs)
    toast.success('Reset request sent to admin.')
  }

  const logoUrl = local.get<string | null>('logo_url', null)
  const appName = settings?.app_name || 'DSN Resource Management'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: 20
    }}>
      {/* Background Image with Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'url("/dsnstaff.JPG")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(135deg, rgba(7, 108, 4, 0.45) 0%, rgba(24, 24, 27, 0.7) 100%)',
      }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 2 }}>
        {/* Logo + Name */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/dsn.png"
            alt="DSN Logo"
            style={{
              height: 120,
              objectFit: 'contain',
              marginBottom: 20,
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
            }}
          />
          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.2,
            fontFamily: 'var(--font-poppins)',
            textShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}>
            {appName}
          </h1>
          <p className="login-welcome">
            {settings?.welcome_message || 'Sign in to your account'}
          </p>
        </div>


        {/* Card with glassmorphism */}
        <div className="card card-lg" style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}>


          {/* STEP: EMAIL */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Sign In</h2>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Enter your work email to continue</p>
              </div>
              {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}
              <div className="form-group">
                <label className="form-label">Work Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@datasciencenigeria.ai"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-lg w-full" type="submit">Continue →</button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'center' }} onClick={() => setStep('forgot')}>
                Forgot PIN?
              </button>
            </form>
          )}

          {/* STEP: PIN */}
          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar avatar-md" style={{ background: 'linear-gradient(135deg, #3B82F6, #7C3AED)', fontSize: 16 }}>
                  {foundUser?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{foundUser?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{foundUser?.department}</div>
                </div>
              </div>
              {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}
              <div className="form-group">
                <label className="form-label">Enter PIN</label>
                <input
                  ref={pinRef}
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  required
                />
              </div>
              <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Sign In'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'center' }} onClick={() => { setStep('email'); setPin(''); setError('') }}>
                ← Back
              </button>
            </form>
          )}

          {/* STEP: CHANGE PIN (first login) */}
          {step === 'change_pin' && (
            <form onSubmit={handleChangePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Set Your PIN</h2>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>First login detected. Please set a new PIN before continuing.</p>
              </div>
              {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}
              <div className="form-group">
                <label className="form-label">New PIN (min 4 digits)</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="New PIN"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New PIN</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  required
                />
              </div>
              <button className="btn btn-primary btn-lg w-full" type="submit">Set PIN & Sign In</button>
            </form>
          )}

          {/* STEP: FORGOT */}
          {step === 'forgot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Forgot PIN</h2>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Enter your email to send a reset request to your admin.</p>
              </div>
              {!forgotSent ? (
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Work Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="you@datasciencenigeria.ai"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button className="btn btn-primary w-full" type="submit">Send Reset Request</button>
                </form>
              ) : (
                <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '14px', borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
                  ✅ Request sent! Your admin will reset your PIN and notify you.
                </div>
              )}
              <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'center' }} onClick={() => { setStep('email'); setForgotSent(false); setError('') }}>
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 20 }}>
          DSN Resource Management System © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
