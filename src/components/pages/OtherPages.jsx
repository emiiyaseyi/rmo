import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { BADGES, genId, avatarColor, initials, fmtDate, timeAgo, exportCSV } from '../../lib/utils'
import toast from 'react-hot-toast'

/* ===================== PROFILE ===================== */
export function ProfilePage() {
  const { user, updateUser, staff, entries, leaves, saveLeaves } = useApp()
  const [tab, setTab] = useState('profile')
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' })
  const [pinError, setPinError] = useState('')
  const [goalHours, setGoalHours] = useState(user?.goalHours || 40)
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', from: '', to: '', reason: '' })
  const [fontSize, setFontSize] = useState(user?.fontSize || 'medium')

  const myEntries = entries.filter(e => e.staffId === user?.id && !e.deleted)
  const totalApproved = myEntries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.hours || 0), 0)
  const myLeaves = leaves.filter(l => l.staffId === user?.id)

  function changePin(e) {
    e.preventDefault()
    setPinError('')
    if (pinForm.current !== user.pin) { setPinError('Current PIN is incorrect'); return }
    if (pinForm.next.length < 4) { setPinError('New PIN must be at least 4 digits'); return }
    if (pinForm.next !== pinForm.confirm) { setPinError('PINs do not match'); return }
    if (pinForm.next === pinForm.current) { setPinError('New PIN must differ from current'); return }
    updateUser({ pin: pinForm.next })
    setPinForm({ current: '', next: '', confirm: '' })
    toast.success('PIN changed successfully')
  }

  function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 300000) { toast.error('Photo must be under 300KB'); return }
    const reader = new FileReader()
    reader.onload = ev => { updateUser({ photo: ev.target.result }); toast.success('Photo updated') }
    reader.readAsDataURL(file)
  }

  function requestLeave(e) {
    e.preventDefault()
    if (!leaveForm.from || !leaveForm.to) { toast.error('Select dates'); return }
    const newLeave = {
      id: genId(),
      staffId: user.id,
      staffName: user.name,
      ...leaveForm,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    saveLeaves([...leaves, newLeave])
    setLeaveForm({ type: 'Annual', from: '', to: '', reason: '' })
    toast.success('Leave request submitted')
  }

  function applyFontSize(size) {
    setFontSize(size)
    updateUser({ fontSize: size })
    document.documentElement.style.fontSize = size === 'small' ? '13px' : size === 'large' ? '16px' : '14px'
    toast.success('Font size updated')
  }

  const currentWeekHours = myEntries
    .filter(e => e.weekKey === new Date().toISOString().slice(0, 7))
    .reduce((s, e) => s + (e.hours || 0), 0)
  const goalProgress = goalHours > 0 ? Math.min((currentWeekHours / goalHours) * 100, 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Profile header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <div className="avatar avatar-xl" style={{ background: avatarColor(user?.name || ''), fontSize: 28 }}>
            {user?.photo ? <img src={user.photo} alt="" /> : initials(user?.name || '')}
          </div>
          <label style={{
            position: 'absolute', bottom: -4, right: -4,
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--accent)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, border: '2px solid var(--bg-card)'
          }}>
            📷
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>{user?.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{user?.role} · {user?.department}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.email}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>🏆 <strong style={{ color: 'var(--gold)' }}>{user?.points || 0}</strong> pts</span>
            <span style={{ fontSize: 13 }}>🔥 <strong>{user?.streak || 0}</strong> week streak</span>
            <span style={{ fontSize: 13 }}>✅ <strong>{totalApproved}h</strong> approved</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['profile', 'security', 'leave', 'badges', 'accessibility'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Weekly Hour Goal</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input className="form-input" type="number" value={goalHours} onChange={e => setGoalHours(parseInt(e.target.value))} style={{ width: 100 }} />
            <button className="btn btn-primary btn-sm" onClick={() => { updateUser({ goalHours }); toast.success('Goal saved') }}>Save</button>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>This week: {currentWeekHours}h / {goalHours}h goal</div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${goalProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Change PIN</h3>
          <form onSubmit={changePin} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 }}>
            {pinError && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{pinError}</div>}
            <div className="form-group">
              <label className="form-label">Current PIN</label>
              <input className="form-input" type="password" inputMode="numeric" value={pinForm.current} onChange={e => setPinForm(f => ({ ...f, current: e.target.value.replace(/\D/g, '') }))} maxLength={8} required />
            </div>
            <div className="form-group">
              <label className="form-label">New PIN (min 4 digits)</label>
              <input className="form-input" type="password" inputMode="numeric" value={pinForm.next} onChange={e => setPinForm(f => ({ ...f, next: e.target.value.replace(/\D/g, '') }))} maxLength={8} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New PIN</label>
              <input className="form-input" type="password" inputMode="numeric" value={pinForm.confirm} onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value.replace(/\D/g, '') }))} maxLength={8} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Change PIN</button>
          </form>
        </div>
      )}

      {tab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Request Leave</h3>
            <form onSubmit={requestLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Leave Type</label>
                  <select className="form-select" value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}>
                    {['Annual', 'Sick', 'Compassionate', 'Unpaid', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div />
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
                <label className="form-label">Reason</label>
                <textarea className="form-textarea" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={2} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Submit Request</button>
            </form>
          </div>

          {myLeaves.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 14 }}>My Leave History</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>From</th><th>To</th><th>Status</th></tr></thead>
                  <tbody>
                    {myLeaves.map(l => (
                      <tr key={l.id}>
                        <td>{l.type}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(l.from)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(l.to)}</td>
                        <td><span className={`badge badge-${l.status === 'approved' ? 'green' : l.status === 'rejected' ? 'red' : 'yellow'}`}>{l.status}</span></td>
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
              <div key={badge.id} className="card" style={{ textAlign: 'center', opacity: earned ? 1 : 0.35, borderColor: earned ? 'var(--gold)' : 'var(--border)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{badge.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{badge.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{badge.desc}</div>
                {earned ? <span className="badge badge-green" style={{ marginTop: 10 }}>Earned ✓</span> : <span className="badge badge-gray" style={{ marginTop: 10 }}>Locked</span>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'accessibility' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Accessibility</h3>
          <div className="form-group">
            <label className="form-label">Font Size</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['small', 'medium', 'large'].map(s => (
                <button key={s} className={`btn btn-sm ${fontSize === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => applyFontSize(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===================== HELP & FAQ ===================== */
export function HelpPage() {
  const { settings } = useApp()
  const [open, setOpen] = useState(null)
  const faqs = settings?.faqs || [
    { id: '1', q: 'When can I submit my timesheet?', a: 'Submission window is Monday 8am to Tuesday 4pm WAT each week.' },
    { id: '2', q: 'What happens if I miss the submission window?', a: 'Contact your admin to request a manual submission or unlock.' },
    { id: '3', q: 'How are points calculated?', a: 'You earn points for submitting on time, getting entries approved, maintaining streaks, and hitting your weekly cap.' },
    { id: '4', q: 'How do I reset my PIN?', a: 'Click "Forgot PIN?" on the login screen. Your admin will reset it and notify you.' },
    { id: '5', q: 'Can I edit an entry after submitting?', a: 'Once submitted, you cannot edit. If rejected, you can resubmit with corrections.' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>❓ Help & FAQ</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Find answers to common questions</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {faqs.map(faq => (
          <div key={faq.id} className="card" style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
            <div
              style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 14 }}
              onClick={() => setOpen(open === faq.id ? null : faq.id)}
            >
              <span>{faq.q}</span>
              <span style={{ fontSize: 18, transition: 'transform 0.2s', transform: open === faq.id ? 'rotate(180deg)' : 'none' }}>⌄</span>
            </div>
            {open === faq.id && (
              <div style={{ padding: '0 20px 14px', fontSize: 13, color: 'var(--text-2)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Forgot your PIN?</h3>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>Submit a reset request and your admin will reset it shortly.</p>
        <button className="btn btn-primary" onClick={() => {
          const email = prompt('Enter your work email:')
          if (email) {
            const reqs = JSON.parse(localStorage.getItem('dsn_pin_reset_requests') || '[]')
            reqs.push({ email, timestamp: new Date().toISOString(), status: 'pending' })
            localStorage.setItem('dsn_pin_reset_requests', JSON.stringify(reqs))
            toast.success('Reset request sent to admin!')
          }
        }}>
          Request PIN Reset
        </button>
      </div>
    </div>
  )
}

/* ===================== ORG CHART ===================== */
export function OrgChartPage() {
  const { staff } = useApp()

  const byDept = staff.reduce((acc, s) => {
    const d = s.department || 'Unassigned'
    if (!acc[d]) acc[d] = []
    acc[d].push(s)
    return acc
  }, {})

  const leads = staff.filter(s => s.role === 'owner' || s.role === 'admin')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🗂️ Org Chart</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{staff.length} staff across {Object.keys(byDept).length} departments</p>
      </div>

      {/* Leadership */}
      {leads.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leadership</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {leads.map(s => (
              <div key={s.id} style={{ textAlign: 'center', minWidth: 100 }}>
                <div className="avatar avatar-lg" style={{ margin: '0 auto 8px', background: avatarColor(s.name), fontSize: 20 }}>
                  {s.photo ? <img src={s.photo} alt="" /> : initials(s.name)}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                <span className={`badge badge-${s.role === 'admin' ? 'red' : 'purple'}`}>{s.role}</span>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{s.department}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Departments */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(byDept).map(([dept, members]) => (
          <div key={dept} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>{dept}</h3>
              <span className="badge badge-blue">{members.length} members</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {members.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', background: 'var(--bg-elevated)',
                  borderRadius: 8, opacity: s.suspended ? 0.4 : 1
                }}>
                  <div className="avatar avatar-sm" style={{ background: avatarColor(s.name), fontSize: 10 }}>
                    {s.photo ? <img src={s.photo} alt="" /> : initials(s.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===================== AUDIT TRAIL ===================== */
export function AuditPage() {
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const logs = JSON.parse(localStorage.getItem('dsn_audit_logs') || '[]')

  const filtered = logs.filter(l => {
    if (search && !l.userName?.toLowerCase().includes(search.toLowerCase()) && !l.action?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterAction && !l.action?.includes(filterAction)) return false
    if (filterDate && !l.timestamp?.startsWith(filterDate)) return false
    return true
  })

  const actionTypes = [...new Set(logs.map(l => l.action?.split('_')[0]).filter(Boolean))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>📝 Audit Trail</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{logs.length} total events logged</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered.map(l => ({ Action: l.action, Detail: l.detail, User: l.userName, Time: l.timestamp })), 'audit_trail.csv')}>
          ⬇ Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search by user or action…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="form-select" style={{ width: 'auto' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className="form-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">No audit logs yet</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text-3)' }}>
                      {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.userName || '—'}</td>
                    <td>
                      <span className={`badge badge-${
                        l.action?.includes('LOGIN') ? 'blue' :
                        l.action?.includes('APPROVE') ? 'green' :
                        l.action?.includes('REJECT') ? 'red' :
                        l.action?.includes('DELETE') ? 'red' :
                        l.action?.includes('LOCKOUT') ? 'red' :
                        'gray'
                      }`}>{l.action}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 400 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.detail}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {filtered.length > 500 && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Showing 500 of {filtered.length} — export CSV for full log</div>
      )}
    </div>
  )
}
