'use client'
import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { getWeekKey, weekRange, fmtDate, initials, avatarColor, getSubmissionWindowStatus, formatTimeUntilDeadline } from '../../lib/utils'
import {
  Clock, CalendarDays, Trophy, Award, CheckSquare, Users, Briefcase,
  ArrowRight, Plus, Flame, AlertTriangle, Lock,
} from 'lucide-react'

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--sh)',
}
const cardLabel: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)',
  textTransform: 'uppercase', letterSpacing: '.05em',
}
const bigNum: React.CSSProperties = {
  fontFamily: 'var(--font-sora)', fontSize: 30, fontWeight: 800,
  color: 'var(--ink)', marginTop: 10, lineHeight: 1,
}

function Countdown() {
  const { settings } = useApp()
  const [timeLeft, setTimeLeft] = useState('')
  const [windowStatus, setWindowStatus] = useState<any>(null)

  const submissionWindow = settings?.submissionWindow || {
    enabled: true,
    schedule: { startDay: 'monday' as const, startTime: '08:00', endDay: 'tuesday' as const, endTime: '16:00' },
    latePenalty: { enabled: true, pointsPerPeriod: -5, periodHours: 12 },
    timezone: 'Africa/Lagos'
  }

  useEffect(() => {
    function calc() {
      const status = getSubmissionWindowStatus(submissionWindow)
      setWindowStatus(status)
      if (!submissionWindow.enabled) { setTimeLeft('Always open'); return }
      if (status.isClosed && status.nextOpens) setTimeLeft(`Opens in ${formatTimeUntilDeadline(status.nextOpens)}`)
      else if (status.isOpen && status.deadline) setTimeLeft(formatTimeUntilDeadline(status.deadline))
      else if (status.isPastDeadline) setTimeLeft(`Late · ${status.penalty} pts penalty`)
      else setTimeLeft('Closed')
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [submissionWindow])

  const isOpen = windowStatus?.isOpen || false
  const isLate = windowStatus?.isPastDeadline || false

  const formatTime = (time: string) => {
    const [h, m] = time.split(':'); const hour = parseInt(h)
    return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`
  }
  const tc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const sw = submissionWindow
  const scheduleText = `${tc(sw.schedule.startDay).slice(0, 3)} ${formatTime(sw.schedule.startTime)} – ${tc(sw.schedule.endDay).slice(0, 3)} ${formatTime(sw.schedule.endTime)} ${sw.timezone.split('/')[1] || 'WAT'}`

  const accent = isLate ? 'var(--warn)' : isOpen ? 'var(--brand)' : 'var(--danger)'
  const tintBg = isLate ? 'var(--warn-tint)' : isOpen ? 'var(--tint)' : 'var(--danger-tint)'
  const statusLabel = isLate ? 'LATE SUBMISSION' : isOpen ? 'OPEN' : 'CLOSED'

  return (
    <div style={{ ...card, padding: '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: tintBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          {isLate ? <AlertTriangle size={26} /> : isOpen ? <Clock size={26} /> : <Lock size={26} />}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Submission window</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: tintBg, color: accent, fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />{statusLabel}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{scheduleText}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-4)' }}>{isOpen ? 'Time remaining' : ''}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: isOpen ? 40 : 22, fontWeight: 700, color: isLate ? 'var(--warn)' : 'var(--ink)', lineHeight: 1.1, letterSpacing: '-.02em' }}>{timeLeft}</div>
      </div>
    </div>
  )
}

const BADGE_ICONS: Record<string, string> = {
  first_blood: '🎯', streak_3: '🔥', streak_5: '⚡', streak_10: '💎',
  full_house: '🏠', early_bird: '🐦', perfect_week: '⭐', top_3: '🏆', centurion: '💯',
}

interface DashboardProps { setPage: (page: string) => void }

export default function Dashboard({ setPage }: DashboardProps) {
  const { user, entries, staff, pendingApprovals, settings, leaves } = useApp()
  const [showNotSubmittedModal, setShowNotSubmittedModal] = useState(false)
  const thisWeek = getWeekKey()

  const myEntries = entries.filter(e => e.staffId === user?.id && e.weekKey === thisWeek && !e.deleted)
  const myHours = myEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const goal = user?.weeklyHourGoal || (user as any)?.weekly_goal || 40
  const submitted = myEntries.some(e => ['submitted', 'approved', 'resubmitted'].includes(e.status))
  const pendingCount = pendingApprovals().length

  const now = new Date()
  const isAdmin = ['admin', 'team_lead'].includes(user?.role || '')
  const isTeamLead = user?.role === 'team_lead'
  const isHigherAdmin = user?.role === 'admin'

  const managedStaff = isTeamLead
    ? staff.filter(s => s.leadId === user?.id && !s.suspended)
    : isHigherAdmin ? staff.filter(s => !s.suspended) : []

  const weekStartStr = thisWeek
  const weekEndStr = (() => { const d = new Date(thisWeek); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) })()
  const onLeaveThisWeek = (staffId: string) => (leaves || []).some((l: any) =>
    l.staffId === staffId && l.status === 'approved' && l.fromDate <= weekEndStr && l.toDate >= weekStartStr)

  const trackableStaff = managedStaff.filter(s => !s.exemptFromTimesheet && !onLeaveThisWeek(s.id))
  const totalStaffCount = trackableStaff.length
  const managedStaffIds = trackableStaff.map(s => s.id)
  const SUBMITTED_STATUSES = ['submitted', 'approved', 'resubmitted', 'pending_2nd_approval', 'pending_clarification']

  const submittedThisWeek = Array.from(new Set(
    entries.filter(e => e.weekKey === thisWeek && managedStaffIds.includes(e.staffId) && SUBMITTED_STATUSES.includes(e.status)).map(e => e.staffId)
  )).length
  const submissionRate = totalStaffCount > 0 ? Math.round((submittedThisWeek / totalStaffCount) * 100) : 0
  const notSubmittedList = trackableStaff.filter(s => !entries.some(e =>
    e.staffId === s.id && e.weekKey === thisWeek && SUBMITTED_STATUSES.includes(e.status)))
  const deptCount = new Set(managedStaff.map(s => s.department).filter(Boolean)).size
  const leadCount = managedStaff.filter(s => s.role === 'team_lead').length

  const recentActivity = entries
    .filter(e => e.staffId === user?.id)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const showGamification = settings?.featureToggles?.gamification

  const topStaff = [...staff].sort((a, b) => (b.points || 0) - (a.points || 0))
  const myRankIdx = topStaff.findIndex(s => s.id === user?.id)

  const rejectedEntries = entries.filter(e => e.staffId === user?.id && e.status === 'rejected' && !e.deleted)
  const clarificationEntries = entries.filter(e => e.staffId === user?.id && e.status === 'pending_clarification' && !e.deleted)

  const statusPill = (status: string) => {
    if (status === 'approved') return { bg: 'var(--tint)', c: 'var(--brand-2)', l: 'Approved' }
    if (status === 'rejected') return { bg: 'var(--danger-tint)', c: 'var(--danger)', l: 'Rejected' }
    if (status === 'submitted' || status === 'resubmitted') return { bg: 'var(--info-tint)', c: 'var(--info)', l: 'Submitted' }
    return { bg: 'var(--elev)', c: 'var(--ink-3)', l: 'Draft' }
  }

  return (
    <>
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)' }}>{greeting}, {user?.name?.split(' ')[0]}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 3 }}>Week of {weekRange(thisWeek)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && pendingCount > 0 && (
            <button onClick={() => setPage('approvals')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--sh-sm)' }}>
              <CheckSquare size={16} />{pendingCount} pending
            </button>
          )}
          <button onClick={() => setPage('timesheet')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(12,122,55,.25)' }}>
            <Plus size={16} />Log hours
          </button>
        </div>
      </div>

      {/* Action required */}
      {(rejectedEntries.length > 0 || clarificationEntries.length > 0) && (
        <div style={{ background: 'var(--danger-tint)', border: '1px solid var(--danger-subtle)', borderRadius: 'var(--r-lg)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}><AlertTriangle size={16} /> Action Required</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rejectedEntries.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Rejected: {e.project}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Reason: {e.rejectionReason || 'No reason provided'}</div></div>
                <button onClick={() => setPage('timesheet')} style={{ padding: '6px 12px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Resubmit</button>
              </div>
            ))}
            {clarificationEntries.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>Clarification Needed: {e.project}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Request: {e.clarificationNote || 'No details provided'}</div></div>
                <button onClick={() => setPage('timesheet')} style={{ padding: '6px 12px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Explain</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission window */}
      <Countdown />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: showGamification ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={cardLabel}>Weekly hours</div><span style={{ display: 'flex', color: 'var(--brand)' }}><Clock size={17} /></span></div>
          <div style={bigNum}>{myHours}<span style={{ fontSize: 16, color: 'var(--ink-3)', fontWeight: 600 }}>/{goal}h</span></div>
          <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}><div style={{ width: `${Math.min((myHours / goal) * 100, 100)}%`, height: '100%', background: myHours >= goal ? 'var(--brand)' : 'var(--brand)', borderRadius: 999 }} /></div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>{myHours >= goal ? 'Goal reached 🎉' : `${Math.max(goal - myHours, 0)}h to reach your goal`}</div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={cardLabel}>Week status</div><span style={{ display: 'flex', color: 'var(--info)' }}><CalendarDays size={17} /></span></div>
          <div style={{ marginTop: 14 }}>
            {submitted ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, background: 'var(--tint)', color: 'var(--brand-2)', fontSize: 13, fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }} />Submitted</span>
            ) : myEntries.length > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, background: 'var(--warn-tint)', color: 'var(--warn)', fontSize: 13, fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)' }} />Draft</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, background: 'var(--elev)', color: 'var(--ink-3)', fontSize: 13, fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-4)' }} />Not started</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 14 }}>{myEntries.length} entries logged{!submitted && myEntries.length > 0 ? ' · not yet submitted' : ''}</div>
        </div>

        {showGamification && (
          <>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={cardLabel}>Total points</div><span style={{ display: 'flex', color: 'var(--gold)' }}><Trophy size={17} /></span></div>
              <div style={bigNum}>{(user?.points || 0).toLocaleString()}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--gold)', fontWeight: 600, marginTop: 10, background: 'var(--gold-tint)', padding: '3px 9px', borderRadius: 999 }}><Flame size={13} />{user?.streak || 0}-week streak</div>
            </div>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={cardLabel}>Badges</div><span style={{ display: 'flex', color: 'var(--violet)' }}><Award size={17} /></span></div>
              <div style={bigNum}>{(user?.badges || []).length}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
                {(user?.badges || []).slice(0, 4).map(b => (
                  <span key={b} style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{BADGE_ICONS[b] || '🏅'}</span>
                ))}
                {(user?.badges || []).length > 4 && (
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 11, fontWeight: 700 }}>+{(user?.badges || []).length - 4}</span>
                )}
                {(user?.badges || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>No badges yet</span>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Admin overview */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{isTeamLead ? 'Team' : 'Org'} submission rate</div><span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Week of {weekRange(thisWeek)}</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}><div style={{ fontFamily: 'var(--font-sora)', fontSize: 38, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{submissionRate}%</div><div style={{ fontSize: 12.5, color: 'var(--ink-3)', paddingBottom: 6 }}>{submittedThisWeek} of {totalStaffCount} submitted</div></div>
            <div style={{ height: 8, background: 'var(--line-2)', borderRadius: 999, margin: '14px 0 16px', overflow: 'hidden' }}><div style={{ width: `${submissionRate}%`, height: '100%', background: submissionRate >= 80 ? 'var(--brand)' : submissionRate >= 60 ? 'var(--warn)' : 'var(--danger)', borderRadius: 999 }} /></div>
            {notSubmittedList.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Not submitted</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {notSubmittedList.slice(0, 5).map(s => (
                    <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--elev)', padding: '4px 10px 4px 4px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: avatarColor(s.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{initials(s.name)}</span>{s.name.split(' ')[0]}
                    </span>
                  ))}
                  {notSubmittedList.length > 5 && (
                    <button onClick={() => setShowNotSubmittedModal(true)} style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--elev)', padding: '4px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: 'var(--brand)', border: 'none', cursor: 'pointer' }}>+{notSubmittedList.length - 5} more</button>
                  )}
                </div>
              </>
            )}
          </div>

          <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Pending my approval</div>
            <div style={{ fontFamily: 'var(--font-sora)', fontSize: 38, fontWeight: 800, color: pendingCount > 0 ? 'var(--warn)' : 'var(--ink)', lineHeight: 1, marginTop: 8 }}>{pendingCount}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, flex: 1 }}>{pendingCount > 0 ? 'Awaiting your review' : 'All caught up ✅'}</div>
            {pendingCount > 0 && (
              <button onClick={() => setPage('approvals')} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, background: 'var(--tint)', color: 'var(--brand-2)', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Review now<ArrowRight size={14} /></button>
            )}
          </div>

          <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>My active staff</div>
            <div style={{ fontFamily: 'var(--font-sora)', fontSize: 38, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, marginTop: 8 }}>{totalStaffCount}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, flex: 1 }}>{leadCount} team lead{leadCount !== 1 ? 's' : ''} · {deptCount} department{deptCount !== 1 ? 's' : ''}</div>
            {isHigherAdmin && (
              <button onClick={() => setPage('staff')} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, background: 'var(--elev)', color: 'var(--ink-2)', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>View roster<ArrowRight size={14} /></button>
            )}
          </div>
        </div>
      )}

      {/* Recent + leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Recent activity</div><span onClick={() => setPage('timesheet')} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>View all</span></div>
          {recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, color: 'var(--ink-2)' }}>No entries yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Start logging your hours for this week</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentActivity.map(e => {
                const p = statusPill(e.status)
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 12, background: 'var(--canvas)', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}><Briefcase size={17} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.project}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div></div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{e.hours}h</div><div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{fmtDate(e.date)}</div></div>
                    <span style={{ flexShrink: 0, padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: p.bg, color: p.c }}>{p.l}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--gold)', display: 'flex' }}><Trophy size={17} /></span>Leaderboard</div><span onClick={() => setPage('leaderboard')} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>Full view</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topStaff.slice(0, 3).map((s, i) => {
              const medal = i === 0 ? 'var(--gold)' : i === 1 ? '#9CA3AF' : '#CD7F32'
              const isMe = s.id === user?.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 'var(--r-sm)', background: isMe ? 'var(--tint)' : 'var(--canvas)', border: isMe ? '1px solid var(--brand)' : '1px solid var(--line)' }}>
                  <div style={{ width: 22, fontFamily: 'var(--font-sora)', fontSize: 14, fontWeight: 800, color: medal, textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(s.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(s.name)}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}{isMe ? <span style={{ color: 'var(--brand)' }}> (You)</span> : ''}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{(s.points || 0).toLocaleString()}</div>
                </div>
              )
            })}
            {myRankIdx > 2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 'var(--r-sm)', background: 'var(--tint)', border: '1px solid var(--brand)', marginTop: 2 }}>
                <div style={{ width: 22, fontFamily: 'var(--font-sora)', fontSize: 14, fontWeight: 800, color: 'var(--ink-3)', textAlign: 'center' }}>{myRankIdx + 1}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(user?.name || ''), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(user?.name || '')}</div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{user?.name} <span style={{ color: 'var(--brand)' }}>(You)</span></div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{(user?.points || 0).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Not-submitted modal */}
    {showNotSubmittedModal && (
      <div className="modal-overlay" onClick={() => setShowNotSubmittedModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <span className="modal-title">Not Submitted — {weekRange(thisWeek)}</span>
            <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowNotSubmittedModal(false)}>✕</button>
          </div>
          <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>{notSubmittedList.length} of {totalStaffCount} staff have not submitted this week.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...notSubmittedList].sort((a, b) => (a.department || '').localeCompare(b.department || '') || a.name.localeCompare(b.name)).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--elev)', borderRadius: 8 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.department || 'No Department'}</div></div>
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>{s.role?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowNotSubmittedModal(false)}>Close</button></div>
        </div>
      </div>
    )}
    </>
  )
}
