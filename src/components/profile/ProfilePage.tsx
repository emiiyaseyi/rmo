'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, avatarColor, initials, BADGES, getWeekKey, weekRange, local } from '../../lib/utils'
import { Staff, Entry, Leave, Template, AppSettings } from '../../types'
import toast from 'react-hot-toast'

interface ProfilePageProps {
  setPage?: (page: string) => void;
  initialTab?: string;
}

export default function ProfilePage({ setPage, initialTab }: ProfilePageProps) {
  const { user, updateUser, staff, entries, leaves, saveLeaves, settings, notify, templates, saveTemplates, setPrefillTemplate, savePasswordResetRequests, passwordResetRequests } = useApp()
  const [tab, setTab] = useState<string>(initialTab || 'overview')
  const [passwordForm, setPasswordForm] = useState({ current: '', newPassword: '', confirm: '' })
  const [passwordError, setPasswordError] = useState<string>('')
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', from: '', to: '', reason: '' })
  const [fontSize, setFontSize] = useState<number>(local.get<number>('font_size', 14))
  const [weeklyGoal, setWeeklyGoal] = useState<number>(user?.weeklyHourGoal || user?.weekly_goal || 40)
  const weekCap = settings?.weekly_cap || 45
  const currentWeek = getWeekKey()
  const myEntries = entries.filter(e => e.staffId === user?.id && !e.deleted)
  const thisWeekEntries = myEntries.filter(e => e.weekKey === currentWeek)
  const thisWeekHours = thisWeekEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const totalHours = myEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const approvedHours = myEntries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.hours || 0), 0)
  const allWeeks = Array.from(new Set(myEntries.map(e => e.weekKey)))
  const submittedWeeks = allWeeks.filter(w => myEntries.some(e => e.weekKey === w && ['submitted', 'approved', 'resubmitted'].includes(e.status)))
  const submitRate = allWeeks.length > 0 ? Math.round((submittedWeeks.length / allWeeks.length) * 100) : 0
  const rank = [...staff].sort((a, b) => (b.points || 0) - (a.points || 0)).findIndex(s => s.id === user?.id) + 1
  const myLeaves = leaves.filter(l => l.staffId === user?.id)

  function validateNewPassword(pass: string) {
    if (pass.length < 4) return 'Password must be at least 4 characters'
    if (pass === '1234') return 'Password cannot be "1234"'
    return null
  }

  function requestReset() {
    if (!user) return
    const exists = passwordResetRequests.find(r => r.staffId === user.id && r.status === 'pending')
    if (exists) { toast.error('Reset request already pending'); return }

    const req = {
      id: genId(),
      staffId: user.id,
      requestedAt: new Date().toISOString(),
      status: 'pending' as const
    }
    savePasswordResetRequests([...passwordResetRequests, req])
    toast.success('Password reset request submitted to admin queue')
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    if (passwordForm.current !== user?.password) { setPasswordError('Current password is incorrect'); return }

    const validationError = validateNewPassword(passwordForm.newPassword)
    if (validationError) { setPasswordError(validationError); return }

    if (passwordForm.newPassword !== passwordForm.confirm) { setPasswordError('Passwords do not match'); return }
    if (passwordForm.newPassword === user?.password) { setPasswordError('New password must differ from current'); return }
    if (passwordForm.newPassword === 'admin') { setPasswordError('Cannot use "admin" as new password'); return }

    updateUser({ password: passwordForm.newPassword, first_login: false })
    setPasswordForm({ current: '', newPassword: '', confirm: '' })
    toast.success('Password updated successfully')
  }

  function submitLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!leaveForm.from || !leaveForm.to) { toast.error('Select dates'); return }
    if (new Date(leaveForm.from) > new Date(leaveForm.to)) { toast.error('End date must be after start'); return }
    const req: Leave = {
      id: genId(),
      staffId: user?.id || '',
      staffName: user?.name || '',
      type: leaveForm.type,
      from: leaveForm.from,
      to: leaveForm.to,
      reason: leaveForm.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    saveLeaves([...leaves, req])
    // Notify admins
    staff.filter(s => s.role === 'admin').forEach(a =>
      notify(a.id, `${user?.name} requested ${leaveForm.type} leave (${leaveForm.from} to ${leaveForm.to})`, 'info')
    )
    setLeaveForm({ type: 'Annual', from: '', to: '', reason: '' })
    toast.success('Leave request submitted')
  }

  function applyFontSize(size: number) {
    setFontSize(size)
    local.set('font_size', size)
    document.documentElement.style.fontSize = size + 'px'
    toast.success('Font size updated')
  }

  function saveWeeklyGoal() {
    updateUser({ weeklyHourGoal: weeklyGoal, weekly_goal: weeklyGoal })
    toast.success('Weekly goal saved')
  }

  function saveCdsDay(day: any) {
    updateUser({ cdsDay: day })
    toast.success('CDS Day updated')
  }

  function flagStreakRecovery() {
    const req = { staffId: user?.id, staffName: user?.name, type: 'streak_recovery', requestedAt: new Date().toISOString(), status: 'pending' }
    const existing = local.get<any[]>('streak_recovery_requests', [])
    local.set('streak_recovery_requests', [...existing, req])
    toast.success('Streak recovery flagged to admin')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Profile header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div className="avatar avatar-xl" style={{ background: avatarColor(user?.name || ''), fontSize: 28 }}>
          {initials(user?.name || '')}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{user?.name}</h1>
            <span className={`badge badge-${user?.role === 'admin' ? 'purple' : 'blue'}`} style={{ fontSize: 10 }}>
              {user?.role?.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>
            {user?.jobTitle ? <strong>{user.jobTitle}</strong> : 'Staff'} · {user?.department}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{user?.points || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Points</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>#{rank}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Rank</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>🔥{user?.streak || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Streak</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{submitRate}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Submit Rate</div>
            </div>
          </div>
        </div>

      </div>

      {/* Weekly goal */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Weekly Hour Goal</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Track progress against your personal target</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input className="form-input" type="number" value={weeklyGoal} onChange={e => setWeeklyGoal(parseInt(e.target.value))} style={{ width: 80 }} min={1} max={weekCap} />
            <button className="btn btn-primary btn-sm" onClick={saveWeeklyGoal}>Save</button>
          </div>
        </div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>{thisWeekHours}h</span>
          <span style={{ color: 'var(--text-3)' }}> / {weeklyGoal}h goal this week</span>
        </div>
        <div className="progress">
          <div className="progress-bar" style={{
            width: `${Math.min((thisWeekHours / weeklyGoal) * 100, 100)}%`,
            background: thisWeekHours >= weeklyGoal ? 'var(--success)' : 'var(--accent)'
          }} />
        </div>
      </div>

      <div className="tabs">
        {['overview', 'change_password', 'leave', 'badges', 'templates', 'accessibility'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'change_password' ? 'Security' : t === 'leave' ? 'Leave' : t === 'badges' ? 'Badges' : t === 'templates' ? '📋 Templates' : 'Accessibility'}
          </div>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 16 }}>My Stats</div>
            {[
              ['Total Hours Logged', totalHours + 'h'],
              ['Approved Hours', approvedHours + 'h'],
              ['Weeks Active', allWeeks.length],
              ['Weeks Submitted', submittedWeeks.length],
              ['Submission Rate', submitRate + '%'],
              ['Badges Earned', (user?.badges || []).length],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{label}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{val}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Account Info</div>
            {[
              ['Name', user?.name],
              ['Email', user?.email],
              ['Department', user?.department || '—'],
              ['Role', user?.role],
              ['Lead', user?.leadName || '—'],
              ['Member Since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{label}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{val}</span>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={flagStreakRecovery}>
              🔥 Request Streak Recovery
            </button>
          </div>
        </div>
      )}

      {tab === 'change_password' && (
        <div className="card" style={{ maxWidth: 420 }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Update Security Password</div>
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {passwordError && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{passwordError}</div>}
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input className="form-input" type="password" value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} />
              <span className="form-hint">Min 8 chars, must include capital & small letters.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>Update Password</button>
              <button className="btn btn-secondary" type="button" onClick={requestReset}>Request Reset</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>"Request Reset" notifies admin to clear your password</div>
          </form>
        </div>
      )}

      {tab === 'overview' && user?.staffType === 'intern' && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Intern Specifics</div>
          <div className="form-group">
            <label className="form-label">CDS Day</label>
            <select className="form-select" value={user.cdsDay || ''} onChange={e => saveCdsDay(e.target.value || null)}>
              <option value="">None</option>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(d => (
                <option key={d} value={d}>{d.toUpperCase()}</option>
              ))}
            </select>
            <span className="form-hint">Selecting a CDS day influences your weekly hour cap calculation.</span>
          </div>
        </div>
      )}

      {tab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ maxWidth: 480 }}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Request Leave</div>
            <form onSubmit={submitLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-select" value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}>
                  {['Annual', 'Sick', 'Maternity', 'Paternity', 'Study', 'Emergency', 'Unpaid'].map(t => (
                    <option key={t} value={t}>{t} Leave</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">From</label>
                  <input className="form-input" type="date" value={leaveForm.from} onChange={e => setLeaveForm(f => ({ ...f, from: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">To</label>
                  <input className="form-input" type="date" value={leaveForm.to} onChange={e => setLeaveForm(f => ({ ...f, to: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason (optional)</label>
                <textarea className="form-textarea" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={2} />
              </div>
              <button className="btn btn-primary" type="submit">Submit Request</button>
            </form>
          </div>

          {myLeaves.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Leave History</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>From</th><th>To</th><th>Status</th><th>Reason</th></tr></thead>
                  <tbody>
                    {myLeaves.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).map(l => (
                      <tr key={l.id}>
                        <td><span className="badge badge-blue">{l.type}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l.from}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l.to}</td>
                        <td><span className={`badge badge-${l.status === 'approved' ? 'green' : l.status === 'rejected' ? 'red' : 'yellow'}`}>{l.status}</span></td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{l.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid-3">
          {BADGES.map(badge => {
            const earned = (user?.badges || []).includes(badge.id)
            return (
              <div key={badge.id} className="card" style={{ textAlign: 'center', opacity: earned ? 1 : 0.35, borderColor: earned ? 'var(--gold)' : 'var(--border)', transition: 'all 0.2s' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{badge.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{badge.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{badge.desc}</div>
                {earned
                  ? <span className="badge badge-green">Earned ✓</span>
                  : <span className="badge badge-gray">Locked</span>
                }
              </div>
            )
          })}
        </div>
      )}

      {tab === 'templates' && (
        <TemplatesTab
          templates={templates}
          saveTemplates={saveTemplates}
          userId={user?.id || ''}
          settings={settings}
          onApply={(t) => {
             setPrefillTemplate(t)
             if (setPage) {
               setPage('timesheet')
             } else {
               window.location.hash = '#/timesheet' // Fallback
             }
             toast.success('Template selected - Ready to fill')
          }}
        />
      )}

      {tab === 'accessibility' && (
        <div className="card" style={{ maxWidth: 420 }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Accessibility</div>
          <div className="form-group">
            <label className="form-label">Font Size</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[12, 13, 14, 15, 16, 18].map(size => (
                <button
                  key={size}
                  className={`btn ${fontSize === size ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => applyFontSize(size)}
                >
                  {size}px
                </button>
              ))}
            </div>
            <span className="form-hint">Preview: The quick brown fox jumps</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface TemplatesTabProps {
  templates: Template[];
  saveTemplates: (data: Template[]) => void;
  userId: string;
  settings: AppSettings | null;
  onApply: (t: Template) => void;
}

function TemplatesTab({ templates, saveTemplates, userId, settings, onApply }: TemplatesTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', project: '', lead: '', description: '', hours: '', category: 'Client Work' })
  const categories = settings?.categories || ['Client Work', 'Internal', 'Training', 'Admin']
  const myTemplates = (templates || []).filter(t => t.userId === userId)

  function saveTemplate() {
    if (!form.name || !form.project) { return }
    const t: Template = {
      ...form,
      hours: form.hours ? parseFloat(form.hours) : undefined,
      id: genId(),
      staffId: userId,
      userId,
      createdAt: new Date().toISOString()
    }
    saveTemplates([...(templates || []), t])
    setForm({ name: '', project: '', lead: '', description: '', hours: '', category: 'Client Work' })
    setShowForm(false)
    toast.success('Template saved')
  }

  function deleteTemplate(id: string) {
    saveTemplates((templates || []).filter(t => t.id !== id))
    toast.success('Template deleted')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Saved Templates</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Pre-fill timesheet entries from saved templates</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ New Template</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Template Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Client Meeting" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project *</label>
              <input className="form-input" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="Project name" />
            </div>
            <div className="form-group">
              <label className="form-label">Lead</label>
              <input className="form-input" value={form.lead} onChange={e => setForm(f => ({ ...f, lead: e.target.value }))} placeholder="Lead name" />
            </div>
            <div className="form-group">
              <label className="form-label">Default Hours</label>
              <input className="form-input" type="number" step="0.5" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="e.g. 2" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Default description" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveTemplate}>Save Template</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {myTemplates.length === 0 && !showForm ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No templates yet</div>
          <div className="empty-state-desc">Save recurring entries as templates to quickly pre-fill your timesheet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myTemplates.map(t => (
            <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  {t.project} {t.lead ? `· ${t.lead}` : ''} {t.hours ? `· ${t.hours}h` : ''} · {t.category}
                </div>
                {t.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.description}</div>}
              </div>
              <span className="badge badge-blue">{t.category}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onApply(t)}>Use</button>
              <button className="btn btn-icon btn-danger btn-sm" onClick={() => deleteTemplate(t.id)} title="Delete template">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
