'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { local, logAudit, genId } from '../../lib/utils'
import { db } from '../../lib/firebase'
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Staff } from '../../types'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { staff, login, settings, saveStaff } = useApp()
  const [step, setStep] = useState<'signin' | 'change_password' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [foundUser, setFoundUser] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)

  function validateNewPassword(pass: string) {
    if (pass.length < 8) return 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(pass)) return 'Password must contain a capital letter'
    if (!/[a-z]/.test(pass)) return 'Password must contain a small letter'
    if (!/[0-9]/.test(pass)) return 'Password must contain a number'
    if (pass === 'dsn-staff' || pass === '1234') return 'Password is blacklisted'
    return null
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email.endsWith('@datasciencenigeria.ai')) {
      setError('Invalid email. Please use your @datasciencenigeria.ai work email.')
      setLoading(false)
      return
    }

    // Find user
    const found = staff.find(s => s.email?.toLowerCase() === email.toLowerCase().trim())

    if (!found) {
      setError('Invalid credentials.')
      setLoading(false)
      return
    }

    // Check persistent lockout from Firestore
    try {
      const userRef = doc(db, 'staff', found.id)
      const userSnap = await getDoc(userRef)
      const securityData = userSnap.data()
      
      if (securityData?.lockout_until && new Date(securityData.lockout_until) > new Date()) {
        const remaining = Math.ceil((new Date(securityData.lockout_until).getTime() - Date.now()) / 60000)
        setError(`Account locked. Try again in ${remaining} minutes.`)
        setLoading(false)
        return
      }

      if (found.suspended) {
        setError('Account suspended.')
        setLoading(false)
        return
      }

      // Check password
      if (found.password !== password) {
        // Increment failed attempts
        const currentFailed = (securityData?.failed_attempts || 0) + 1
        let lockoutUpdate = {}
        if (currentFailed >= 5) {
          const lockoutTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
          lockoutUpdate = { failed_attempts: currentFailed, lockout_until: lockoutTime }
          setError('Too many failed attempts. Account locked for 30 minutes.')
          logAudit('LOCKOUT', `${found.name} account locked for 30 min`, found.id, found.name)
        } else {
          lockoutUpdate = { failed_attempts: currentFailed }
          setError(`Invalid credentials. ${5 - currentFailed} attempts remaining.`)
        }
        await setDoc(userRef, lockoutUpdate, { merge: true })
        setLoading(false)
        return
      }

      // Success
      await login(found)
      setLoading(false)
    } catch (e: any) {
      console.error('Login error:', e)
      setError('An error occurred during sign-in. Please try again.')
      setLoading(false)
    }
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!foundUser) return
    setError('')

    const validationError = validateNewPassword(newPassword)
    if (validationError) { setError(validationError); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword === 'admin') { setError('Cannot use "admin" as new password.'); return }

    const updatedUser: Staff = { ...foundUser, password: newPassword, first_login: false }

    // Persist change via context
    saveStaff(staff.map(s => s.id === updatedUser.id ? updatedUser : s))

    login(updatedUser)
    toast.success('Password updated successfully!')
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const found = staff.find(s => s.email?.toLowerCase() === email.toLowerCase().trim())
      if (found) {
        const reqRef = doc(db, 'reset_requests', genId())
        await setDoc(reqRef, {
          userId: found.id,
          userName: found.name,
          email: found.email,
          timestamp: new Date().toISOString(),
          status: 'pending'
        })
      }
      setForgotSent(true)
      toast.success('Reset request sent to admin.')
    } catch (e: any) {
      toast.error('Failed to send reset request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: 24,
      fontFamily: 'var(--font-poppins)',
      background: '#0F172A'
    }}>

      {/* Background Image with Clearer Visibility */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'url("/dsnstaff.JPG")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'brightness(0.85) contrast(1.05)',
        transform: 'scale(1)'
      }} />

      {/* Subtle Decorative Gradient Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'radial-gradient(circle at center, rgba(7, 108, 4, 0.1) 0%, rgba(15, 23, 42, 0.5) 100%)',
      }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 10 }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/dsn.png"
            alt="DSN Logo"
            style={{
              height: 100,
              objectFit: 'contain',
              marginBottom: 16,
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))'
            }}
          />
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#4ADE80',
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            marginBottom: 8,
            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
          }}>
            Resource Management
          </h2>
        </div>

        {/* GLASS CARD */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRadius: 32,
          padding: 40,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6)',
        }}>

          {/* CENTRALIZED BIG HEADER */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{
              fontSize: 36,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.02em',
              marginBottom: 8
            }}>
              Sign In
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
              {step === 'signin' ? 'Access your dashboard' :
                step === 'change_password' ? 'Update default password' : 'Recover security access'}
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              color: '#FCA5A5',
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 13,
              marginBottom: 20,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* SIGN IN FORM (ONE PAGE) */}
          {step === 'signin' && (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Work Email</label>
                <input
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    color: 'white',
                    fontSize: 16,
                    outline: 'none',
                    width: '100%'
                  }}
                  type="email"
                  placeholder="name@datasciencenigeria.ai"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={passwordRef}
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      paddingRight: '48px',
                      color: 'white',
                      fontSize: 16,
                      outline: 'none',
                      width: '100%'
                    }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4
                    }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'var(--brand-primary)',
                  color: 'white',
                  borderRadius: 14,
                  padding: '15px',
                  fontSize: 16,
                  fontWeight: 800,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s',
                  marginTop: 8,
                  boxShadow: '0 8px 20px rgba(7, 108, 4, 0.4)'
                }}
              >
                {loading ? 'Authenticating…' : 'Continue →'}
              </button>

              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', alignSelf: 'center', marginTop: 8 }}
                onClick={() => setStep('forgot')}
              >
                Forgotten your password?
              </button>
            </form>
          )}

          {/* CHANGE PASSWORD STEP */}
          {step === 'change_password' && (
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: 14, borderRadius: 12, marginBottom: 4 }}>
                <p style={{ color: '#4ADE80', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>Default password detected. Please set a secure password with capital & small letters.</p>
              </div>

              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      paddingRight: '48px',
                      color: 'white',
                      fontSize: 16,
                      outline: 'none',
                      width: '100%'
                    }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4
                    }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Confirm New Password</label>
                <input
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    color: 'white',
                    fontSize: 16,
                    outline: 'none',
                    width: '100%'
                  }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'var(--brand-primary)',
                  color: 'white',
                  borderRadius: 14,
                  padding: '15px',
                  fontSize: 16,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: 8
                }}
              >
                Secure Account & Log In
              </button>
            </form>
          )}

          {/* FORGOT STEP */}
          {step === 'forgot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!forgotSent ? (
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Recovery Email</label>
                    <input
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        padding: '14px 16px',
                        color: 'white',
                        fontSize: 16,
                        outline: 'none',
                        width: '100%'
                      }}
                      type="email"
                      placeholder="you@datasciencenigeria.ai"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: 'var(--brand-primary)',
                      color: 'white',
                      borderRadius: 14,
                      padding: '14px',
                      fontSize: 15,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Send Recovery Request
                  </button>
                </form>
              ) : (
                <div style={{
                  background: 'rgba(5, 150, 105, 0.2)',
                  border: '1px solid rgba(5, 150, 105, 0.3)',
                  color: '#A7F3D0', padding: '24px', borderRadius: 20, fontSize: 14, textAlign: 'center'
                }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>📬</div>
                  Reset Instructions Sent!<br />Please check your email.
                </div>
              )}
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', alignSelf: 'center' }}
                onClick={() => { setStep('signin'); setForgotSent(false); setError('') }}
              >
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 32, letterSpacing: '0.05em' }}>
          DSN RESOURCE MANAGEMENT SYSTEM • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
