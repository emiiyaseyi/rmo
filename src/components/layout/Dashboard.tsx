'use client'
import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { getWeekKey, weekRange, fmtDate, isSubmissionOpen, initials, avatarColor, getSubmissionWindowStatus, formatTimeUntilDeadline } from '../../lib/utils'
import PageHeader from '../common/PageHeader'
import Skeleton from '../common/Skeleton'

function Countdown() {
  const { settings } = useApp()
  const [timeLeft, setTimeLeft] = useState('')
  const [status, setStatus] = useState<'safe' | 'urgent'>('safe')

  const submissionWindow = settings?.submissionWindow || {
    enabled: true,
    schedule: { startDay: 'monday' as const, startTime: '08:00', endDay: 'tuesday' as const, endTime: '16:00' },
    latePenalty: { enabled: true, pointsPerPeriod: -5, periodHours: 12 },
    timezone: 'Africa/Lagos'
  }

  const [windowStatus, setWindowStatus] = useState<any>(null)

  useEffect(() => {
    function calc() {
      const status = getSubmissionWindowStatus(submissionWindow)
      setWindowStatus(status)

      if (!submissionWindow.enabled) {
        setTimeLeft('Always open')
        setStatus('safe')
        return
      }

      if (status.isClosed && status.nextOpens) {
        // Window hasn't opened yet
        const formatted = formatTimeUntilDeadline(status.nextOpens)
        setTimeLeft(`Opens in ${formatted}`)
        setStatus('safe')
      } else if (status.isOpen && status.deadline) {
        // Window is currently open - show countdown to deadline
        const formatted = formatTimeUntilDeadline(status.deadline)
        setTimeLeft(formatted)

        // Check if less than 2 hours remaining
        const diff = status.deadline.getTime() - new Date().getTime()
        const hoursLeft = diff / (1000 * 60 * 60)
        setStatus(hoursLeft < 2 ? 'urgent' : 'safe')
      } else if (status.isPastDeadline) {
        // Past deadline - late submission with penalty
        setTimeLeft(`Late submission (${status.penalty} pts penalty)`)
        setStatus('urgent')
      } else {
        // Fallback
        setTimeLeft('Submission closed')
        setStatus('safe')
      }
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [submissionWindow])

  const isOpen = windowStatus?.isOpen || false

  // Format schedule display
  const formatTime = (time: string) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const hour12 = hour % 12 || 12
    return `${hour12}:${m}${ampm}`
  }

  const titleCase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
  const scheduleText = `${titleCase(submissionWindow.schedule.startDay).slice(0, 3)} ${formatTime(submissionWindow.schedule.startTime)} – ${titleCase(submissionWindow.schedule.endDay).slice(0, 3)} ${formatTime(submissionWindow.schedule.endTime)} ${submissionWindow.timezone.split('/')[1] || 'WAT'}`

  return (
    <div style={{
      background: 'var(--bg-card)', 
      border: '1px solid var(--border)',
      borderRadius: 16, 
      padding: '24px 32px',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      boxShadow: '0 4px 12px var(--shadow)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative glows */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: isOpen ? 'var(--success-bg)' : 'var(--danger-bg)', opacity: 0.3, filter: 'blur(30px)' }}></div>
      <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'var(--accent-subtle)', opacity: 0.1, filter: 'blur(30px)' }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: windowStatus?.isPastDeadline ? 'var(--warning-bg)' : (isOpen ? 'var(--success-bg)' : 'var(--danger-bg)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          {windowStatus?.isPastDeadline ? '⚠️' : (isOpen ? '⏰' : '🔒')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Submission Window
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
             <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 14px', borderRadius: 20,
                background: windowStatus?.isPastDeadline ? 'var(--warning-bg)' : (isOpen ? 'var(--success-bg)' : 'var(--danger-bg)'),
                color: windowStatus?.isPastDeadline ? 'var(--warning)' : (isOpen ? 'var(--success)' : 'var(--danger)'),
                fontSize: 12, fontWeight: 800,
                border: `1px solid ${windowStatus?.isPastDeadline ? 'var(--warning)' : (isOpen ? 'var(--success)' : 'var(--danger)')}33`
             }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }} />
                {windowStatus?.isPastDeadline ? 'LATE SUBMISSION' : (isOpen ? 'WINDOW OPEN' : 'WINDOW CLOSED')}
             </div>
             {!isOpen && timeLeft.startsWith('Opens') && (
               <span style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 700 }}>{timeLeft}</span>
             )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontWeight: 500, opacity: 0.8 }}>
             Schedule: {scheduleText}
          </div>
        </div>
      </div>

      {isOpen && (
        <div style={{
          textAlign: 'right',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2, letterSpacing: '0.1em', opacity: 0.7 }}>
            Remaining Time
          </div>
          <div style={{
            fontSize: 56,
            fontWeight: 900,
            color: status === 'urgent' ? 'var(--danger)' : 'var(--text-1)',
            fontFamily: 'var(--mono)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {timeLeft}
          </div>
        </div>
      )}

      {!isOpen && !timeLeft.startsWith('Opens') && (
        <div style={{ fontSize: 16, fontWeight: 700, color: windowStatus?.isPastDeadline ? 'var(--warning)' : 'var(--text-3)', opacity: windowStatus?.isPastDeadline ? 1 : 0.5, fontStyle: windowStatus?.isPastDeadline ? 'normal' : 'italic' }}>
          {timeLeft}
        </div>
      )}
    </div>
  )
}

interface DashboardProps {
  setPage: (page: string) => void;
}

export default function Dashboard({ setPage }: DashboardProps) {
  const { user, entries, staff, pendingApprovals, unreadCount, settings, approvalDelegations, leaves } = useApp()
  const [showNotSubmittedModal, setShowNotSubmittedModal] = useState(false)
  const thisWeek = getWeekKey()

  const myEntries = entries.filter(e => e.staffId === user?.id && e.weekKey === thisWeek && !e.deleted)
  const myHours = myEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const submitted = myEntries.some(e => e.status === 'submitted' || e.status === 'approved' || e.status === 'resubmitted')
  const pendingCount = pendingApprovals().length

  // Check if user has active delegations (delegated TO them)
  const now = new Date()
  const hasActiveDelegation = approvalDelegations.some(d =>
    d.delegateId === user?.id &&
    d.isActive &&
    new Date(d.startDate) <= now &&
    new Date(d.endDate) >= now
  )

  const isAdmin = ['admin', 'team_lead'].includes(user?.role || '') || hasActiveDelegation
  const isTeamLead = user?.role === 'team_lead'
  const isHigherAdmin = ['admin'].includes(user?.role || '')

  // Filter staff based on role
  const managedStaff = isTeamLead 
    ? staff.filter(s => s.leadId === user?.id && !s.suspended)
    : isHigherAdmin 
      ? staff.filter(s => !s.suspended)
      : []

  // Exclude exempt staff from submission tracking
  // Week range for this week (Mon → Sun) used to check leave overlap
  const weekStartStr = thisWeek // weekKey is the Monday YYYY-MM-DD
  const weekEndStr = (() => {
    const d = new Date(thisWeek)
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()
  // Staff on approved leave overlapping this week are exempt from compliance flags
  const onLeaveThisWeek = (staffId: string) => (leaves || []).some((l: any) =>
    l.staffId === staffId && l.status === 'approved' &&
    l.fromDate <= weekEndStr && l.toDate >= weekStartStr
  )

  const trackableStaff = managedStaff.filter(s => !s.exemptFromTimesheet && !onLeaveThisWeek(s.id))

  const totalStaffCount = trackableStaff.length
  const managedStaffIds = trackableStaff.map(s => s.id)

  const SUBMITTED_STATUSES = ['submitted', 'approved', 'resubmitted', 'pending_2nd_approval', 'pending_clarification']

  const submittedThisWeek = Array.from(new Set(
    entries.filter(e =>
      e.weekKey === thisWeek &&
      managedStaffIds.includes(e.staffId) &&
      SUBMITTED_STATUSES.includes(e.status)
    ).map(e => e.staffId)
  )).length

  const submissionRate = totalStaffCount > 0 ? Math.round((submittedThisWeek / totalStaffCount) * 100) : 0
  const notSubmittedList = trackableStaff.filter(s => !entries.some(e =>
    e.staffId === s.id &&
    e.weekKey === thisWeek &&
    SUBMITTED_STATUSES.includes(e.status)
  ))

  const recentActivity = entries
    .filter(e => e.staffId === user?.id)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)

  return (
    <>
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
      
      {/* Action Items */}
      {(() => {
        const clarificationEntries = entries.filter(e => e.staffId === user?.id && e.status === 'pending_clarification' && !e.deleted)
        const rejectedEntries = entries.filter(e => e.staffId === user?.id && e.status === 'rejected' && !e.deleted)
        if (rejectedEntries.length === 0 && clarificationEntries.length === 0) return null
        
        return (
          <div style={{ 
            background: 'var(--danger-bg)', 
            border: '1px solid rgba(216, 0, 26, 0.1)', 
            borderRadius: 12, 
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>
              <span>🚨</span> Action Required
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rejectedEntries.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Rejected: {e.project}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Reason: {e.rejectionReason || 'No reason provided'}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setPage('timesheet')}>Resubmit</button>
                </div>
              ))}
              {clarificationEntries.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Clarification Needed: {e.project}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Request: {e.clarificationNote || 'No details provided'}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setPage('timesheet')}>Explain</button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Countdown */}
      <Countdown />

      {/* My stats */}
      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-label">Weekly Hour Goal</div>
          <div className="stat-value" style={{ color: myHours >= (user?.weeklyHourGoal || user?.weekly_goal || 40) ? 'var(--success)' : 'var(--text-1)' }}>
            {myHours}h
          </div>
          <div className="stat-sub">target: {user?.weeklyHourGoal || user?.weekly_goal || 40}h</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <div className="progress-bar" style={{ width: `${Math.min((myHours / (user?.weeklyHourGoal || user?.weekly_goal || 40)) * 100, 100)}%`, background: myHours >= (user?.weeklyHourGoal || user?.weekly_goal || 40) ? 'var(--success)' : 'var(--accent)' }} />
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

        {settings?.featureToggles?.gamification && (
          <>
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
          </>
        )}
      </div>

      {/* Admin overview */}
      {isAdmin && (
        <div className="grid-3">
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="stat-label">{isTeamLead ? 'Team' : 'Org'} Submission Rate</div>
            <div className="stat-value">{submissionRate}%</div>
            <div className="stat-sub">{submittedThisWeek} of {totalStaffCount} {isTeamLead ? 'team members' : 'staff'} submitted</div>
            <div className="progress" style={{ marginTop: 8 }}>
              <div className="progress-bar" style={{ width: `${submissionRate}%`, background: submissionRate >= 80 ? 'var(--success)' : submissionRate >= 60 ? 'var(--warning)' : 'var(--danger)' }} />
            </div>
            {notSubmittedList.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Not Submitted:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {notSubmittedList.slice(0, 5).map(s => (
                    <span key={s.id} className="badge badge-gray" style={{ fontSize: 9 }}>{s.name.split(' ')[0]}</span>
                  ))}
                  {notSubmittedList.length > 5 && (
                    <button
                      onClick={() => setShowNotSubmittedModal(true)}
                      style={{ fontSize: 9, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      +{notSubmittedList.length - 5} more
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="stat-card" style={{ borderLeft: '3px solid var(--warning)' }}>
            <div className="stat-label">Pending My Approval</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{pendingCount}</div>
            <div className="stat-sub">
              {pendingCount > 0 ? (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setPage('approvals')}>Review now →</button>
              ) : 'All caught up! ✅'}
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
            <div className="stat-label">My {isTeamLead ? 'Team' : 'Active Staff'}</div>
            <div className="stat-value">{totalStaffCount}</div>
            <div className="stat-sub">{managedStaff.filter(s => s.role === 'team_lead').length} team leads</div>
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

      {/* Leaderboard & Actions */}
      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>🏆 Leaderboard</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage('leaderboard')}>Full View</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...staff]
              .sort((a, b) => (b.points || 0) - (a.points || 0))
              .slice(0, 3)
              .map((s, i) => (
                <div key={s.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '8px 12px', 
                  background: s.id === user?.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  borderRadius: 8,
                  border: s.id === user?.id ? '1px solid var(--accent)' : '1px solid transparent'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, width: 20, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }}>
                    {i + 1}
                  </div>
                  <div className="avatar avatar-sm" style={{ background: avatarColor(s.name), fontSize: 9 }}>
                    {initials(s.name)}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name} {s.id === user?.id && '(You)'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                    {s.points?.toLocaleString() || 0}
                  </div>
                </div>
              ))}
            
            {/* My Rank if not in top 3 */}
            {(() => {
              const sorted = [...staff].sort((a, b) => (b.points || 0) - (a.points || 0))
              const myIdx = sorted.findIndex(s => s.id === user?.id)
              if (myIdx > 2) {
                const me = sorted[myIdx]
                return (
                  <>
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 10 }}>•••</div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '8px 12px', 
                      background: 'var(--accent-subtle)',
                      borderRadius: 8,
                      border: '1px solid var(--accent)'
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 800, width: 20 }}>{myIdx + 1}</div>
                      <div className="avatar avatar-sm" style={{ background: avatarColor(me.name), fontSize: 9 }}>
                        {initials(me.name)}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{me.name} (You)</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{me.points?.toLocaleString() || 0}</div>
                    </div>
                  </>
                )
              }
              return null
            })()}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>⚡ Quick Actions</h3>
          </div>
          <div className="grid-2" style={{ gap: 10 }}>
            <button className="btn btn-secondary" style={{ height: 'auto', padding: '16px', flexDirection: 'column', gap: 8 }} onClick={() => setPage('timesheet')}>
              <span style={{ fontSize: 24 }}>📋</span>
              <span>Log Hours</span>
            </button>
            <button className="btn btn-secondary" style={{ height: 'auto', padding: '16px', flexDirection: 'column', gap: 8 }} onClick={() => setPage('messages')}>
              <span style={{ fontSize: 24 }}>💬</span>
              <span>Messages</span>
            </button>
            <button className="btn btn-secondary" style={{ height: 'auto', padding: '16px', flexDirection: 'column', gap: 8 }} onClick={() => setPage('help')}>
              <span style={{ fontSize: 24 }}>❓</span>
              <span>Help Center</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Not-submitted staff modal */}
    {showNotSubmittedModal && (
      <div className="modal-overlay" onClick={() => setShowNotSubmittedModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <span className="modal-title">Not Submitted — {weekRange(thisWeek)}</span>
            <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowNotSubmittedModal(false)}>✕</button>
          </div>
          <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              {notSubmittedList.length} of {totalStaffCount} staff have not submitted a timesheet this week.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...notSubmittedList].sort((a, b) => (a.department || '').localeCompare(b.department || '') || a.name.localeCompare(b.name)).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.department || 'No Department'}</div>
                  </div>
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>{s.role?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowNotSubmittedModal(false)}>Close</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
