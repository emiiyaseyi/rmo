import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { getWeekKey, weekRange, fmtDate, isSubmissionOpen } from '../../lib/utils'

function Countdown() {
  const [timeLeft, setTimeLeft] = useState('')
  const [status, setStatus] = useState('safe')

  useEffect(() => {
    function calc() {
      const now = new Date()
      const wat = new Date(now.getTime() + 60 * 60 * 1000)
      const day = wat.getUTCDay()
      const hour = wat.getUTCHours()
      const min = wat.getUTCMinutes()
      const sec = wat.getUTCSeconds()

      // Deadline: Tuesday 4pm WAT
      let deadlineWAT = new Date(wat)
      // Find next Tuesday 16:00 WAT
      const daysUntilTue = (2 - day + 7) % 7 || (day === 2 && (hour < 16) ? 0 : 7)
      deadlineWAT.setUTCDate(deadlineWAT.getUTCDate() + daysUntilTue)
      deadlineWAT.setUTCHours(16, 0, 0, 0)

      // Open: Monday 8am WAT
      const openWAT = new Date(deadlineWAT)
      openWAT.setUTCDate(openWAT.getUTCDate() - 1)
      openWAT.setUTCHours(8, 0, 0, 0)

      if (wat < openWAT) {
        // Before window opens
        const diff = openWAT - wat
        const dh = Math.floor(diff / 3600000)
        const dm = Math.floor((diff % 3600000) / 60000)
        setTimeLeft(`Opens in ${dh}h ${dm}m`)
        setStatus('safe')
      } else if (wat <= deadlineWAT) {
        // Window open
        const diff = deadlineWAT - wat
        const dh = Math.floor(diff / 3600000)
        const dm = Math.floor((diff % 3600000) / 60000)
        const ds = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${String(dh).padStart(2,'0')}:${String(dm).padStart(2,'0')}:${String(ds).padStart(2,'0')} remaining`)
        setStatus(dh < 2 ? 'urgent' : 'safe')
      } else {
        setTimeLeft('Submission closed')
        setStatus('safe')
      }
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [])

  const isOpen = isSubmissionOpen()
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16
    }}>
      <span style={{ fontSize: 28 }}>{isOpen ? '⏰' : '🔒'}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>
          Submission Window
        </div>
        <div className={`countdown-chip${status === 'urgent' ? ' urgent' : isOpen ? '' : ' safe'}`}>
          {isOpen ? '🟢 OPEN' : '🔴 CLOSED'} — {timeLeft}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
          Mon 8:00am – Tue 4:00pm WAT
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ setPage }) {
  const { user, entries, staff, pendingApprovals, unreadCount } = useApp()
  const thisWeek = getWeekKey()

  const myEntries = entries.filter(e => e.staffId === user?.id && e.weekKey === thisWeek && !e.deleted)
  const myHours = myEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const submitted = myEntries.some(e => e.status === 'submitted' || e.status === 'approved' || e.status === 'resubmitted')
  const pendingCount = pendingApprovals().length

  // Stats for admin/owner
  const totalStaff = staff.filter(s => !s.suspended).length
  const submittedThisWeek = [...new Set(
    entries.filter(e => e.weekKey === thisWeek && (e.status === 'submitted' || e.status === 'approved' || e.status === 'resubmitted')).map(e => e.staffId)
  )].length
  const submissionRate = totalStaff > 0 ? Math.round((submittedThisWeek / totalStaff) * 100) : 0

  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const recentActivity = entries
    .filter(e => e.staffId === user?.id)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>
            Week of {weekRange(thisWeek)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setPage('timesheet')}>
            📋 Log Hours
          </button>
          {isAdmin && pendingCount > 0 && (
            <button className="btn btn-secondary" onClick={() => setPage('approvals')}>
              ✅ {pendingCount} Pending
            </button>
          )}
        </div>
      </div>

      {/* Countdown */}
      <Countdown />

      {/* My stats */}
      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-label">Hours This Week</div>
          <div className="stat-value" style={{ color: myHours >= 45 ? 'var(--success)' : myHours >= 35 ? 'var(--warning)' : 'var(--text-1)' }}>
            {myHours}h
          </div>
          <div className="stat-sub">of 45h cap</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <div className="progress-bar" style={{ width: `${Math.min((myHours / 45) * 100, 100)}%`, background: myHours >= 45 ? 'var(--success)' : myHours >= 35 ? 'var(--warning)' : 'var(--accent)' }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Week Status</div>
          <div style={{ marginTop: 8 }}>
            {submitted ? (
              <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 12px' }}>✅ Submitted</span>
            ) : myEntries.length > 0 ? (
              <span className="badge badge-yellow" style={{ fontSize: 13, padding: '6px 12px' }}>📝 Draft</span>
            ) : (
              <span className="badge badge-gray" style={{ fontSize: 13, padding: '6px 12px' }}>⬜ Not Started</span>
            )}
          </div>
          <div className="stat-sub" style={{ marginTop: 8 }}>{myEntries.length} entries logged</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Points</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>
            {(user?.points || 0).toLocaleString()}
          </div>
          <div className="stat-sub">🔥 Streak: {user?.streak || 0} weeks</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Badges Earned</div>
          <div className="stat-value">{(user?.badges || []).length}</div>
          <div className="stat-sub" style={{ marginTop: 4 }}>
            {(user?.badges || []).slice(0, 3).map(b => {
              const badge = [
                { id: 'first_blood', icon: '🎯' }, { id: 'streak_3', icon: '🔥' }, { id: 'streak_5', icon: '⚡' },
                { id: 'streak_10', icon: '💎' }, { id: 'full_house', icon: '🏠' }, { id: 'early_bird', icon: '🐦' },
                { id: 'perfect_week', icon: '⭐' }, { id: 'top_3', icon: '🏆' }, { id: 'centurion', icon: '💯' }
              ].find(x => x.id === b)
              return <span key={b} style={{ fontSize: 18 }}>{badge?.icon}</span>
            })}
          </div>
        </div>
      </div>

      {/* Admin overview */}
      {isAdmin && (
        <div className="grid-3">
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="stat-label">Submission Rate</div>
            <div className="stat-value">{submissionRate}%</div>
            <div className="stat-sub">{submittedThisWeek} of {totalStaff} staff submitted</div>
            <div className="progress" style={{ marginTop: 8 }}>
              <div className="progress-bar" style={{ width: `${submissionRate}%`, background: submissionRate >= 80 ? 'var(--success)' : submissionRate >= 60 ? 'var(--warning)' : 'var(--danger)' }} />
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '3px solid var(--warning)' }}>
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{pendingCount}</div>
            <div className="stat-sub">
              {pendingCount > 0 ? (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setPage('approvals')}>Review now →</button>
              ) : 'All caught up! ✅'}
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
            <div className="stat-label">Active Staff</div>
            <div className="stat-value">{totalStaff}</div>
            <div className="stat-sub">{staff.filter(s => s.suspended).length} suspended</div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Recent Activity</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage('timesheet')}>View All</button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No entries yet</div>
            <div className="empty-state-desc">Start logging your hours for this week</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentActivity.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: 'var(--bg-elevated)',
                borderRadius: 8
              }}>
                <div style={{ fontSize: 20 }}>
                  {e.status === 'approved' ? '✅' : e.status === 'rejected' ? '❌' : e.status === 'submitted' ? '📤' : '📝'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.project}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{e.hours}h</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(e.date)}</div>
                </div>
                <span className={`badge badge-${e.status === 'approved' ? 'green' : e.status === 'rejected' ? 'red' : e.status === 'submitted' ? 'blue' : 'gray'}`}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid-3">
        {[
          { icon: '📊', title: 'Analytics', desc: 'View team performance', page: 'analytics', role: 'admin' },
          { icon: '🏆', title: 'Leaderboard', desc: 'See rankings & badges', page: 'leaderboard' },
          { icon: '💬', title: 'Messages', desc: unreadCount > 0 ? `${unreadCount} unread messages` : 'Team communication', page: 'messages' },
        ].filter(q => !q.role || user?.role === q.role || user?.role === 'admin').map(q => (
          <div
            key={q.page}
            className="card"
            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => setPage(q.page)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{q.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{q.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{q.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
