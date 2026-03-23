import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { local, logAudit } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { staff, login, settings } = useApp()
  const [step, setStep] = useState('email') // email | pin | change_pin | forgot
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const pinRef = useRef(null)

  useEffect(() => {
    if (step === 'pin') pinRef.current?.focus()
  }, [step])

  function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    const found = staff.find(s => s.email?.toLowerCase() === email.toLowerCase().trim())
    if (!found) { setError('No account found with this email.'); return }
    if (found.suspended) { setError('Your account is suspended. Contact admin.'); return }

    // Check lockout
    const lockoutKey = `lockout_${found.id}`
    const lockout = local.get(lockoutKey)
    if (lockout && Date.now() < lockout.until) {
      const mins = Math.ceil((lockout.until - Date.now()) / 60000)
      setError(`Account locked. Try again in ${mins} minute(s).`)
      return
    }

    setFoundUser(found)
    setStep('pin')
  }

  function handlePinSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const lockoutKey = `lockout_${foundUser.id}`
      const attemptsKey = `attempts_${foundUser.id}`

      if (pin !== foundUser.pin) {
        const attempts = (local.get(attemptsKey) || 0) + 1
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

  function handleChangePinSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return }
    if (newPin === foundUser.pin) { setError('New PIN must be different from current PIN.'); return }

    // Update staff record
    const { saveStaff, staff: allStaff } = window.__dsn_app || {}
    // We'll use a global ref pattern — simpler: dispatch to context via login
    const updatedUser = { ...foundUser, pin: newPin, first_login: false }
    // This will be handled by the parent — pass via sessionStorage
    sessionStorage.setItem('dsn_pin_change', JSON.stringify(updatedUser))
    login(updatedUser)
    toast.success('PIN updated! Welcome to DSN RMS.')
  }

  function handleForgot(e) {
    e.preventDefault()
    setForgotSent(true)
    // Log the request
    const reqs = local.get('pin_reset_requests', [])
    reqs.push({ email, timestamp: new Date().toISOString(), status: 'pending' })
    local.set('pin_reset_requests', reqs)
    toast.success('Reset request sent to admin.')
  }

  const logoUrl = local.get('logo_url')
  const appName = settings?.app_name || 'DSN Resource Management'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0
      }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)'
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo + Name */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="DSN Logo" style={{ height: 56, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #3B82F6, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24, fontWeight: 800, color: 'white'
            }}>D</div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.2 }}>{appName}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            {settings?.welcome_message || 'Sign in to your account'}
          </p>
        </div>

        {/* Card */}
        <div className="card card-lg" style={{ boxShadow: 'var(--shadow)' }}>

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
