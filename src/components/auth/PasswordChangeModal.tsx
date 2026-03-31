'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react'

export default function PasswordChangeModal() {
  const { user, updateUser, setShowPasswordChange, staff, saveStaff } = useApp()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const validate = (pass: string) => {
    if (pass.length < 8) return 'Minimum 8 characters'
    if (!/[A-Z]/.test(pass)) return 'Must contain an uppercase letter'
    if (!/[a-z]/.test(pass)) return 'Must contain a lowercase letter'
    if (!/[0-9]/.test(pass)) return 'Must contain a number'
    if (pass === 'dsn-staff' || pass === '1234') return 'Password is blacklisted'
    return null
  }

  const error = validate(newPassword)
  const mismatch = newPassword !== confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (error || mismatch || !user) return
    setLoading(true)
    try {
      await fetch(`/api/staff/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, first_login: false, password_reset_pending: false }),
      })

      // Update Local State
      const updatedUser = { ...user, password: newPassword, first_login: false, password_reset_pending: false }
      updateUser(updatedUser)
      saveStaff(staff.map(s => s.id === user.id ? updatedUser : s))

      setShowPasswordChange(false)
      toast.success('Password updated successfully!')
    } catch (e: any) {
      toast.error('Failed to update password: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'rgba(7, 108, 4, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--brand-primary)'
          }}>
            <Lock size={30} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Update Password</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
            For your security, you must change your default or reset password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Secure password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            {mismatch && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</p>}
          </div>

          {/* Requirements List */}
          <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
             {[
               { label: '8+ Characters', met: newPassword.length >= 8 },
               { label: 'Uppercase & Lowercase', met: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) },
               { label: 'Includes a Number', met: /[0-9]/.test(newPassword) },
               { label: 'Not a default value', met: !['dsn-staff', '1234'].includes(newPassword) },
             ].map((req, i) => (
               <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: req.met ? 'var(--success)' : 'var(--text-3)' }}>
                 {req.met ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                 {req.label}
               </div>
             ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !!error || mismatch || !newPassword}
            style={{ padding: 14, fontWeight: 700, marginTop: 8 }}
          >
            {loading ? 'Updating…' : 'Secure Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
