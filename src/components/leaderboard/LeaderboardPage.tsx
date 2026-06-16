'use client'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { BADGES, genId, exportCSV, exportPDF, avatarColor, getWeekKey } from '../../lib/utils'
import { Staff, HofEntry, Reward, Redemption, PointsHistoryEntry } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

const MEDAL = ['🥇', '🥈', '🥉']

interface RankedStaff extends Staff {
  submissionRate: number;
}

interface DeptRank {
  dept: string;
  members: number;
  totalPts: number;
  totalRate: number;
  avgPts: number;
  avgRate: number;
}

export default function LeaderboardPage() {
  const { staff, user, entries, hof, saveHof, rewards, saveRewards, redeems, saveRedeems, awardPoints, streakRecoveries, saveStreakRecoveries, saveStaff, notify, settings, leaves } = useApp()
  const [tab, setTab] = useState('individual')
  const [showShop, setShowShop] = useState(false)
  const [showAddReward, setShowAddReward] = useState(false)
  const [rewardForm, setRewardForm] = useState({ name: '', desc: '', cost: '', icon: '🎁' })
  const [recoveryForm, setRecoveryForm] = useState({ weekId: '', reason: '' })
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, action: () => void, message: string, title?: string}>({isOpen: false, action: () => {}, message: ''})

  // Period filter
  type PeriodType = 'alltime' | 'week' | 'month' | 'custom'
  const [periodType, setPeriodType] = useState<PeriodType>('alltime')
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [customFrom, setCustomFrom] = useState<string>('')
  const [customTo, setCustomTo] = useState<string>('')
  const [periodHistory, setPeriodHistory] = useState<PointsHistoryEntry[]>([])
  const [periodLoading, setPeriodLoading] = useState(false)
  const periodFetchKey = useRef('')

  // Reviewal period filter (independent of submission period)
  const [reviewPeriodType, setReviewPeriodType] = useState<PeriodType>('alltime')
  const [reviewSelectedWeek, setReviewSelectedWeek] = useState<string>('')
  const [reviewSelectedMonth, setReviewSelectedMonth] = useState<string>('')
  const [reviewCustomFrom, setReviewCustomFrom] = useState<string>('')
  const [reviewCustomTo, setReviewCustomTo] = useState<string>('')

  // Derive available weeks and months from entries weekKeys
  const availableWeeks = useMemo(() => {
    const weeks = Array.from(new Set(entries.map(e => e.weekKey).filter(Boolean))).sort().reverse()
    return weeks
  }, [entries])

  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(availableWeeks.map(w => w.slice(0, 7)))).sort().reverse()
    return months
  }, [availableWeeks])

  // Set sensible defaults when period type changes
  useEffect(() => {
    if (periodType === 'week' && !selectedWeek && availableWeeks.length > 0) {
      setSelectedWeek(availableWeeks[0])
    }
    if (periodType === 'month' && !selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0])
    }
  }, [periodType, availableWeeks, availableMonths])

  useEffect(() => {
    if (reviewPeriodType === 'week' && !reviewSelectedWeek && availableWeeks.length > 0) {
      setReviewSelectedWeek(availableWeeks[0])
    }
    if (reviewPeriodType === 'month' && !reviewSelectedMonth && availableMonths.length > 0) {
      setReviewSelectedMonth(availableMonths[0])
    }
  }, [reviewPeriodType, availableWeeks, availableMonths])

  // Fetch points history when period filter is active
  useEffect(() => {
    if (periodType === 'alltime') { setPeriodHistory([]); return }
    let param = ''
    let key = ''
    if (periodType === 'week') {
      if (!selectedWeek) return
      param = `weekId=${selectedWeek}`; key = `week:${selectedWeek}`
    } else if (periodType === 'month') {
      if (!selectedMonth) return
      param = `month=${selectedMonth}`; key = `month:${selectedMonth}`
    } else if (periodType === 'custom') {
      if (!customFrom || !customTo) return
      param = `from=${customFrom}&to=${customTo}`; key = `custom:${customFrom}:${customTo}`
    }
    if (periodFetchKey.current === key) return
    periodFetchKey.current = key
    setPeriodLoading(true)
    fetch(`/api/points-history?${param}`)
      .then(r => r.json())
      .then(data => { setPeriodHistory(Array.isArray(data) ? data : []); setPeriodLoading(false) })
      .catch(() => { setPeriodHistory([]); setPeriodLoading(false) })
  }, [periodType, selectedWeek, selectedMonth, customFrom, customTo])

  const SUBMITTED_STATUSES = ['submitted', 'approved', 'resubmitted', 'pending_clarification', 'pending_2nd_approval']

  // A week (Monday YYYY-MM-DD) overlaps an approved leave for this staff member
  function weekOnLeave(staffId: string, weekKey: string): boolean {
    const weekEnd = new Date(weekKey)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().slice(0, 10)
    return (leaves || []).some((l: any) =>
      l.staffId === staffId && l.status === 'approved' &&
      l.fromDate <= weekEndStr && l.toDate >= weekKey
    )
  }

  function calcSubmissionRate(s: Staff) {
    const myEntries = entries.filter(e => e.staffId === s.id)
    // Exclude weeks the staff member was on approved leave — not counted as missed
    const weeks = Array.from(new Set(myEntries.map(e => e.weekKey))).filter(w => !weekOnLeave(s.id, w))
    const submitted = weeks.filter(w => myEntries.some(e => e.weekKey === w && SUBMITTED_STATUSES.includes(e.status)))
    return weeks.length > 0 ? Math.round((submitted.length / weeks.length) * 100) : 0
  }

  // Points for a staff member in the selected period
  function getPeriodPoints(staffId: string): number {
    if (periodType === 'alltime') return staff.find(s => s.id === staffId)?.points ?? 0
    return periodHistory
      .filter(h => h.staffId === staffId)
      .reduce((sum, h) => sum + (h.points ?? 0), 0)
  }

  // Submission leaderboard — all staff, ranked by points (period-aware)
  const allRanked: RankedStaff[] = useMemo(() =>
    staff
      .filter(s => !s.suspended)
      .map(s => ({ ...s, submissionRate: calcSubmissionRate(s), points: getPeriodPoints(s.id) }))
      .filter(s => {
        const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
        const matchDept = !deptFilter || s.department === deptFilter
        return matchSearch && matchDept
      })
      .sort((a, b) => (b.points || 0) - (a.points || 0)),
    [staff, entries, search, deptFilter, periodType, periodHistory]
  )

  const ranked = allRanked

  const myRank = allRanked.findIndex(s => s.id === user?.id) + 1

  // Reviewal leaderboard — team leads & admins, ranked by review speed score
  interface ReviewerStat {
    id: string; name: string; role: string; department?: string;
    totalReviewed: number; avgScore: number;
  }

  function reviewSpeedScore(submittedAt: string | undefined, reviewedAt: string | undefined, weekKey: string): number {
    if (!submittedAt || !reviewedAt) return 0
    const subWin = settings?.submissionWindow
    // weekKey = Monday of the week, format "YYYY-MM-DD" (WAT). Derive submission
    // deadline from it: Monday + endDay offset + endTime, all in WAT (UTC+1).
    let deadlineMs: number | null = null
    if (subWin?.enabled && subWin.schedule && /^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
      const mondayUtcMidnight = Date.parse(weekKey + 'T00:00:00Z')
      if (!isNaN(mondayUtcMidnight)) {
        const WAT_MS = 60 * 60 * 1000
        // WAT Monday 00:00 expressed in UTC ms
        const watMondayUtc = mondayUtcMidnight - WAT_MS
        const DAY: Record<string, number> = { monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:7 }
        const endDayOff = (DAY[subWin.schedule.endDay.toLowerCase()] || 2) - 1
        const [h, m] = subWin.schedule.endTime.split(':').map(Number)
        deadlineMs = watMondayUtc + endDayOff * 86400000 + (h * 3600000 + m * 60000)
      }
    }
    const reviewedMs = new Date(reviewedAt).getTime()
    if (deadlineMs !== null && reviewedMs <= deadlineMs) return 100
    // Hours after deadline (or after submission if no deadline config)
    const baseMs = deadlineMs !== null ? deadlineMs : new Date(submittedAt).getTime()
    const hoursAfter = (reviewedMs - baseMs) / (1000 * 60 * 60)
    if (hoursAfter <= 2) return 80
    if (hoursAfter <= 24) return 60
    return 0
  }

  // Best timestamp for when an entry was reviewed: approval/rejection time, else last update
  const reviewDateOf = (e: any): string | undefined =>
    (e.status === 'approved' ? e.approvedAt : e.status === 'rejected' ? e.rejectedAt : undefined) || e.updatedAt

  const reviewalRanked: ReviewerStat[] = useMemo(() => {
    const filteredForReview = reviewPeriodType === 'alltime'
      ? entries
      : entries.filter(e => {
          const rd = reviewDateOf(e)
          if (!rd) return false
          const d = rd.slice(0, 10)
          if (reviewPeriodType === 'month') return d.startsWith(reviewSelectedMonth)
          if (reviewPeriodType === 'week') {
            const weekStart = new Date(reviewSelectedWeek)
            const weekEnd = new Date(reviewSelectedWeek)
            weekEnd.setDate(weekEnd.getDate() + 6)
            const entryDate = new Date(d)
            return entryDate >= weekStart && entryDate <= weekEnd
          }
          if (reviewPeriodType === 'custom') {
            if (!reviewCustomFrom || !reviewCustomTo) return true
            return d >= reviewCustomFrom && d <= reviewCustomTo
          }
          return true
        })
    const reviewers = staff.filter(s => !s.suspended && (s.role === 'team_lead' || s.role === 'admin'))
    return reviewers.map(s => {
      const reviewed = filteredForReview.filter(e =>
        !e.deleted && (
          ((e.approvedBy === s.id || e.approvedByName === s.name) && e.status === 'approved') ||
          (e.rejectedBy === s.id && e.status === 'rejected')
        )
      )
      const scores = reviewed
        .filter(e => e.submittedAt && reviewDateOf(e) && e.weekKey)
        .map(e => reviewSpeedScore(e.submittedAt, reviewDateOf(e), e.weekKey))
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0
      return { id: s.id, name: s.name, role: s.role, department: s.department, totalReviewed: reviewed.length, avgScore }
    })
    .filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
      const matchDept = !deptFilter || s.department === deptFilter
      return matchSearch && matchDept
    })
    .sort((a, b) => b.avgScore - a.avgScore || b.totalReviewed - a.totalReviewed)
  }, [staff, entries, search, deptFilter, settings, reviewPeriodType, reviewSelectedWeek, reviewSelectedMonth, reviewCustomFrom, reviewCustomTo])

  // Department leaderboard
  const deptRanked: DeptRank[] = useMemo(() => {
    const depts: Record<string, DeptRank> = {}
    staff.filter(s => !s.suspended && s.department).forEach(s => {
      const deptName = s.department || 'Other'
      if (!depts[deptName]) {
        depts[deptName] = { dept: deptName, members: 0, totalPts: 0, totalRate: 0, avgPts: 0, avgRate: 0 }
      }
      const d = depts[deptName]
      d.members++
      d.totalPts += s.points || 0
      const myEntries = entries.filter(e => e.staffId === s.id)
      const weeks = Array.from(new Set(myEntries.map(e => e.weekKey)))
      const submitted = weeks.filter(w => myEntries.some(e => e.weekKey === w && SUBMITTED_STATUSES.includes(e.status)))
      d.totalRate += weeks.length > 0 ? (submitted.length / weeks.length) * 100 : 0
    })
    return Object.values(depts).map(d => ({
      ...d,
      avgPts: d.members > 0 ? Math.round(d.totalPts / d.members) : 0,
      avgRate: d.members > 0 ? Math.round(d.totalRate / d.members) : 0,
    })).sort((a, b) => b.avgPts - a.avgPts)
  }, [staff, entries])

  function saveHofNow() {
    const top3: HofEntry[] = ranked.slice(0, 3).map((s, i) => ({ ...s, rank: i + 1, savedAt: new Date().toISOString() }))
    saveHof(top3)
    toast.success('Hall of Fame updated!')
  }

  function addReward() {
    if (!rewardForm.name || !rewardForm.cost) { toast.error('Name and cost required'); return }
    const r: Reward = {
      ...rewardForm,
      id: genId(),
      cost: parseInt(rewardForm.cost),
      active: true,
      stock: 10, // Default stock
      isEnabled: true,
      createdAt: new Date().toISOString()
    }
    saveRewards([...rewards, r])
    setRewardForm({ name: '', desc: '', cost: '', icon: '🎁' })
    setShowAddReward(false)
    toast.success('Reward added')
  }

  function redeemReward(reward: Reward) {
    if (!user) return
    if (reward.stock <= 0) { toast.error('Item out of stock'); return }
    const myPts = user.points || 0
    if (myPts < reward.cost) { toast.error('Not enough points'); return }

    setConfirmAction({
      isOpen: true,
      action: () => {
        const redeem: Redemption = {
      id: genId(),
      staffId: user.id,
      staffName: user.name,
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    // Deduct stock
    const updatedRewards = rewards.map(r => r.id === reward.id ? { ...r, stock: r.stock - 1 } : r)
    saveRewards(updatedRewards)

        saveRedeems([...redeems, redeem])
        awardPoints(user.id, -reward.cost, `Redeemed ${reward.name}`)
        toast.success('🎁 Redemption request sent to admin!')
      },
      message: `Redeem "${reward.name}" for ${reward.cost} pts?`,
      title: 'Confirm Redemption'
    })
  }

  function handleRecoveryRequest() {
    if (!recoveryForm.weekId || !recoveryForm.reason) { toast.error('Week and reason required'); return }
    const req = {
      id: genId(),
      staffId: user!.id,
      staffName: user!.name,
      weekId: recoveryForm.weekId,
      reason: recoveryForm.reason,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    }
    saveStreakRecoveries([...streakRecoveries, req])
    setRecoveryForm({ weekId: '', reason: '' })
    toast.success('Recovery request submitted')
  }

  function resolveRecovery(reqId: string, status: 'approved' | 'rejected') {
    const req = streakRecoveries.find(r => r.id === reqId)
    if (!req) return
    
    const updated = streakRecoveries.map(r => r.id === reqId ? { ...r, status, reviewedBy: user?.name, reviewedAt: new Date().toISOString() } : r)
    saveStreakRecoveries(updated)
    notify(req.staffId, `Your streak recovery request was ${status}.`, status === 'approved' ? 'streak_recovery_approved' : 'streak_recovery_declined', `Streak Recovery ${status === 'approved' ? 'Approved' : 'Declined'}`, reqId, 'message')
    
    if (status === 'approved') {
      const sIdx = staff.findIndex(s => s.id === req.staffId)
      if (sIdx > -1) {
        const updatedStaff = [...staff]
        updatedStaff[sIdx] = { ...updatedStaff[sIdx], streak: (updatedStaff[sIdx].streak || 0) + 1 }
        saveStaff(updatedStaff)
        awardPoints(req.staffId, 5, 'Streak Recovery Bonus', req.weekId)
      }
    }
    toast.success(`Request ${status}`)
  }

  function fulfillRedeem(id: string) {
    const updated = redeems.map(r => r.id === id ? { ...r, status: 'fulfilled' as const, fulfilledAt: new Date().toISOString() } : r)
    saveRedeems(updated)
    const r = redeems.find(x => x.id === id)
    if (r) notify(r.staffId, `Your redemption for ${r.rewardName} has been fulfilled!`, 'redemption_fulfilled', 'Reward Fulfilled', id, 'message')
    toast.success('Reward fulfilled!')
  }

  const handleReviewExport = (format: 'csv' | 'pdf') => {
    const data = reviewalRanked.map((s, i) => ({
      Rank: i + 1,
      Reviewer: s.name,
      Department: s.department || '—',
      Role: s.role.replace('_', ' '),
      Reviewed: s.totalReviewed,
      AvgScore: s.avgScore,
    }))
    if (format === 'csv') {
      exportCSV(data, `reviewal_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Exported CSV')
    } else {
      const cols = [
        { key: 'Rank', label: '#' },
        { key: 'Reviewer', label: 'Reviewer' },
        { key: 'Department', label: 'Dept' },
        { key: 'Reviewed', label: 'Reviewed' },
        { key: 'AvgScore', label: 'Avg Score' },
      ]
      exportPDF(data, cols, 'Reviewal Leaderboard', `reviewal_leaderboard_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('Exported PDF')
    }
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    const data = ranked.map((s, i) => ({
      Rank: i + 1,
      Name: s.name,
      Department: s.department || '—',
      Points: s.points || 0,
      SubmissionRate: s.submissionRate + '%',
      Streak: s.streak || 0
    }))
    
    if (format === 'csv') {
      exportCSV(data, `leaderboard_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Exported CSV')
    } else {
      const cols = [
        { key: 'Rank', label: '#' },
        { key: 'Name', label: 'Name' },
        { key: 'Department', label: 'Dept' },
        { key: 'Points', label: 'Pts' },
        { key: 'SubmissionRate', label: 'Rate' },
        { key: 'Streak', label: '🔥' }
      ]
      exportPDF(data, cols, 'Staff Leaderboard', `leaderboard_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('Exported PDF')
    }
  }

  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ... rest of the UI ... */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏆 Leaderboard</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Rankings, badges & rewards</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowShop(!showShop)}>
            🛍️ Points Shop
          </button>
          {user?.role === 'admin' && (
            <button className="btn btn-secondary btn-sm" onClick={saveHofNow}>Save Hall of Fame</button>
          )}
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
        borderRadius: 14, padding: 20, color: 'white',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ fontSize: 40 }}>{myRank > 0 && myRank <= 3 ? MEDAL[myRank - 1] : `#${myRank || '-'}`}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Your Rank</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>#{myRank || '-'} of {ranked.length}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{user?.points || 0} points · {user?.streak || 0} week streak</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Badges</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 120 }}>
            {(user?.badges || []).map(b => {
              const badge = BADGES.find(x => x.id === b)
              return badge ? <span key={b} style={{ fontSize: 20 }} title={badge.name}>{badge.icon}</span> : null
            })}
            {(user?.badges || []).length === 0 && <span style={{ opacity: 0.6, fontSize: 12 }}>No badges yet</span>}
          </div>
        </div>
      </div>

      <div className="tabs">
        {['individual', 'reviewal', 'department', 'badges', 'hof', 'recovery'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'individual' ? '📋 Submission' : t === 'reviewal' ? '✅ Reviewal' : t === 'department' ? '🏢 Departments' : t === 'badges' ? '🏅 Badges' : t === 'hof' ? '🏛️ Hall of Fame' : '🔄 Recovery'}
          </div>
        ))}
      </div>

      {tab === 'individual' && (
        <div className="flex flex-col gap-4" style={{ paddingBottom: 4 }}>
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-3 flex-1 min-w-[300px]">
                <input
                  className="form-input flex-1"
                  placeholder="Search staff..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select className="form-select w-48" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>💾 CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>📕 PDF</button>
              </div>
            </div>
            {/* Period filter row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-3 uppercase tracking-wider">Period:</span>
              {(['alltime', 'week', 'month', 'custom'] as PeriodType[]).map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${periodType === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPeriodType(p)}
                >
                  {p === 'alltime' ? 'All Time' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom Range'}
                </button>
              ))}
              {periodType === 'week' && (
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={selectedWeek}
                  onChange={e => { setSelectedWeek(e.target.value); periodFetchKey.current = '' }}
                >
                  {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              )}
              {periodType === 'month' && (
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: 140 }}
                  value={selectedMonth}
                  onChange={e => { setSelectedMonth(e.target.value); periodFetchKey.current = '' }}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>
                      {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              )}
              {periodType === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={e => { setCustomFrom(e.target.value); periodFetchKey.current = '' }}
                  />
                  <span className="text-xs text-3">to</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={e => { setCustomTo(e.target.value); periodFetchKey.current = '' }}
                  />
                </div>
              )}
              {periodLoading && <span className="text-xs text-3 animate-pulse">Loading...</span>}
              {periodType !== 'alltime' && !periodLoading && (
                <span className="text-xs text-3">
                  {periodType === 'week'
                    ? `Showing points earned week of ${selectedWeek}`
                    : periodType === 'month'
                      ? `Showing points earned in ${new Date((selectedMonth || '2000-01') + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
                      : customFrom && customTo
                        ? `Showing points earned ${customFrom} → ${customTo}`
                        : 'Pick a start and end date'}
                </span>
              )}
            </div>
          </div>
          {/* Pinned My Rank Card (if not in top 25) */}
          {(myRank > 25 || myRank === 0) && (
            <div className="card border-accent bg-accent-subtle relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold opacity-50">#{myRank || '?'}</div>
                <div className="flex-1">
                  <div className="font-bold text-1">{user?.name} (You)</div>
                  <div className="text-xs text-3">{user?.points || 0} points · {user?.streak || 0}w streak</div>
                </div>
                {myRank > 25 && (
                  <div className="text-right">
                    <div className="text-xs text-4">To enter Top 25</div>
                    <div className="font-bold text-accent">+{ (ranked[24]?.points || 0) - (user?.points || 0) + 1 } pts</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Points</th>
                    <th>Performance</th>
                    <th>Streak</th>
                    <th>Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 25).map((s, i) => {
                    const isMe = s.id === user?.id
                    const relWidth = Math.max(5, Math.round(((s.points || 0) / (ranked[0]?.points || 1)) * 100))
                    return (
                      <tr key={s.id} className={isMe ? 'bg-accent-subtle' : ''}>
                        <td className="font-bold text-lg">
                          {i < 3 ? MEDAL[i] : (i < 25 ? `🏅 #${i + 1}` : `#${i + 1}`)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                             <div className="avatar avatar-xs" style={{ background: `hsl(${(s.name?.charCodeAt(0) || 0) * 40 % 360}, 60%, 45%)` }}>
                                {s.name?.[0]}
                             </div>
                            <span className="font-bold">{s.name}{isMe ? ' (You)' : ''}</span>
                          </div>
                          <div className="text-4 text-xs">{s.department}</div>
                        </td>
                        <td className="font-bold text-accent">{(s.points || 0).toLocaleString()}</td>
                        <td style={{ minWidth: 140 }}>
                          <div className="flex flex-col gap-1">
                            <div className="progress h-1.5 w-full bg-border rounded-full overflow-hidden">
                                <div className="progress-bar h-full bg-accent" style={{ width: `${relWidth}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-4">
                                <span>{s.submissionRate}% rate</span>
                                <span>{relWidth}% of top</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {s.streak ? <span className="badge badge-yellow">🔥 {s.streak}</span> : <span className="text-4">—</span>}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {(s.badges || []).slice(0, 3).map(b => {
                              const badge = BADGES.find(x => x.id === b)
                              return badge ? <span key={b} title={badge.name}>{badge.icon}</span> : null
                            })}
                            {(s.badges || []).length > 3 && <span className="text-4 text-xs">+{s.badges!.length - 3}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Scoring rubric:</span>
            {[
              { score: 3, label: `Early (within ${settings?.pointsConfig?.earlySubmissionHours ?? 4}h of window opening) · +4 after 3 consecutive early weeks`, color: 'var(--success)' },
              { score: 2, label: 'On-time (within submission window)', color: 'var(--accent)' },
              { score: 1, label: 'Late addition (after window closes)', color: 'var(--warning)' },
              { score: -1, label: 'Outside window', color: 'var(--danger)' },
            ].map(({ score, label, color }, i, arr) => (
              <React.Fragment key={score}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 800, color, fontFamily: 'var(--mono)' }}>{score > 0 ? `+${score}` : score}</span>
                  <span>{label}</span>
                </span>
                {i < arr.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {tab === 'reviewal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <span className="text-xs font-semibold text-3 uppercase tracking-wider">Period:</span>
              {(['alltime', 'week', 'month', 'custom'] as PeriodType[]).map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${reviewPeriodType === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setReviewPeriodType(p)}
                >
                  {p === 'alltime' ? 'All Time' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom Range'}
                </button>
              ))}
              {reviewPeriodType === 'week' && (
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={reviewSelectedWeek}
                  onChange={e => setReviewSelectedWeek(e.target.value)}
                >
                  {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              )}
              {reviewPeriodType === 'month' && (
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: 140 }}
                  value={reviewSelectedMonth}
                  onChange={e => setReviewSelectedMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>
                      {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              )}
              {reviewPeriodType === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={reviewCustomFrom}
                    max={reviewCustomTo || undefined}
                    onChange={e => setReviewCustomFrom(e.target.value)}
                  />
                  <span className="text-xs text-3">to</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={reviewCustomTo}
                    min={reviewCustomFrom || undefined}
                    onChange={e => setReviewCustomTo(e.target.value)}
                  />
                </div>
              )}
              {reviewPeriodType !== 'alltime' && (
                <span className="text-xs text-3">
                  {reviewPeriodType === 'week'
                    ? `Showing reviews week of ${reviewSelectedWeek}`
                    : reviewPeriodType === 'month'
                      ? `Showing reviews in ${new Date((reviewSelectedMonth || '2000-01') + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
                      : reviewCustomFrom && reviewCustomTo
                        ? `Showing reviews ${reviewCustomFrom} → ${reviewCustomTo}`
                        : 'Pick a start and end date'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => handleReviewExport('csv')}>💾 CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleReviewExport('pdf')}>📕 PDF</button>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Reviewer</th>
                  <th>Reviewed</th>
                  <th title="Avg score based on review speed: 100 within submission window, 80 within 2h after, 60 within 24h, 0 after 24h">Avg Score</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {reviewalRanked.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No review data yet</td></tr>
                )}
                {reviewalRanked.map((s, i) => {
                  const scoreColor = s.avgScore >= 80 ? 'var(--success)' : s.avgScore >= 40 ? 'var(--warning)' : s.totalReviewed > 0 ? 'var(--danger)' : 'var(--text-3)'
                  const scoreLabel = s.avgScore === 100 ? 'Excellent' : s.avgScore >= 80 ? 'Great' : s.avgScore >= 60 ? 'Good' : s.avgScore >= 40 ? 'Fair' : s.avgScore > 0 ? 'Slow' : '—'
                  return (
                    <tr key={s.id} className={s.id === user?.id ? 'bg-accent-subtle' : ''}>
                      <td className="font-bold text-lg">{i < 3 ? MEDAL[i] : `#${i + 1}`}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-xs" style={{ background: `hsl(${(s.name?.charCodeAt(0) || 0) * 40 % 360}, 60%, 45%)` }}>{s.name?.[0]}</div>
                          <div>
                            <span className="font-bold">{s.name}{s.id === user?.id ? ' (You)' : ''}</span>
                            <div className="text-xs text-3">{s.department} · {s.role.replace('_', ' ')}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{s.totalReviewed}</td>
                      <td>
                        {s.totalReviewed === 0
                          ? <span className="text-4">—</span>
                          : <span style={{ fontWeight: 800, color: scoreColor, fontFamily: 'var(--mono)', fontSize: 16 }}>{s.avgScore}</span>
                        }
                      </td>
                      <td>
                        {s.totalReviewed === 0 ? <span className="text-4">—</span> : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress" style={{ width: 80 }}>
                              <div className="progress-bar" style={{ width: `${s.avgScore}%`, background: scoreColor }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor }}>{scoreLabel}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Scoring rubric:</span>
          {[
            { score: 100, label: 'Within submission window', color: 'var(--success)' },
            { score: 80, label: '≤ 2h after window closes', color: 'var(--accent)' },
            { score: 60, label: '≤ 24h after window closes', color: 'var(--warning)' },
            { score: 0, label: 'After 24h', color: 'var(--danger)' },
          ].map(({ score, label, color }, i, arr) => (
            <React.Fragment key={score}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontWeight: 800, color, fontFamily: 'var(--mono)' }}>{score}</span>
                <span>{label}</span>
              </span>
              {i < arr.length - 1 && <span style={{ opacity: 0.4 }}>→</span>}
            </React.Fragment>
          ))}
        </div>
        </div>
      )}

      {tab === 'department' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Department</th>
                  <th>Members</th>
                  <th>Avg Points</th>
                  <th>Avg Submit Rate</th>
                </tr>
              </thead>
              <tbody>
                {deptRanked.map((d, i) => (
                  <tr key={d.dept}>
                    <td style={{ fontWeight: 700, fontSize: 18 }}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</td>
                    <td style={{ fontWeight: 600 }}>{d.dept}</td>
                    <td>{d.members}</td>
                    <td style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--mono)' }}>{d.avgPts}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ width: 80 }}>
                          <div className="progress-bar" style={{ width: `${d.avgRate}%`, background: d.avgRate >= 80 ? 'var(--success)' : 'var(--warning)' }} />
                        </div>
                        <span>{d.avgRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BADGES.map(badge => {
            const earned = (user?.badges || []).includes(badge.id)
            return (
              <div key={badge.id} className={`card flex items-center gap-4 ${earned ? 'border-accent bg-accent-subtle' : 'opacity-50 grayscale'}`}>
                <div className="text-4xl">{badge.icon}</div>
                <div className="flex-1">
                  <div className="font-bold">{badge.name}</div>
                  <div className="text-xs text-3">{badge.desc}</div>
                  {!earned && <div className="text-[10px] text-accent mt-1 uppercase font-bold tracking-wider">Earn: {badge.id.replace(/_/g, ' ')}...</div>}
                </div>
                {earned && <div className="text-accent">✓</div>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'hof' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hof.length === 0 ? (
            <div className="empty-state card col-span-full">
              <div className="empty-state-icon">🏛️</div>
              <div className="empty-state-title">Hall of Fame is empty</div>
              <p className="text-4 text-xs mt-2">Admins can save a snapshot of the current Top 3.</p>
            </div>
          ) : (
            hof.map((s, i) => (
              <div key={s.id} className="card text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 font-bold text-4xl">#{s.rank}</div>
                <div className="text-5xl mb-4">{MEDAL[s.rank - 1]}</div>
                <div className="font-bold text-lg">{s.name}</div>
                <div className="text-xs text-4 mb-3">{s.department}</div>
                <div className="text-2xl font-bold text-accent">{(s.points || 0).toLocaleString()} <span className="text-xs uppercase opacity-60">pts</span></div>
                {s.savedAt && <div className="text-[10px] text-4 mt-4 italic">Snapshot: {new Date(s.savedAt).toLocaleDateString()}</div>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'recovery' && (
        <div className="flex flex-col gap-6">
          {user?.role !== 'admin' && (
            <div className="card w-full" style={{ maxWidth: 700, margin: '0 auto', border: 'none', background: 'linear-gradient(145deg, var(--bg-card), var(--bg-hover))', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ width: 64, height: 64, borderRadius: '20px', background: 'var(--warning-bg)', border: '1px solid rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0, boxShadow: '0 8px 16px rgba(234, 179, 8, 0.15)' }}>
                  🔥
                </div>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Request Streak Recovery</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                    Missed a timesheet submission? Request a recovery to keep your streak alive.<br/>
                    <strong style={{ color: 'var(--warning)' }}>Limit: Once per month.</strong>
                  </p>
                </div>
              </div>
              
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '24px 28px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div className="grid-2" style={{ marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Week ID</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 18 }}>📅</span>
                      <input 
                        className="form-input" 
                        value={recoveryForm.weekId} 
                        onChange={e => setRecoveryForm({ ...recoveryForm, weekId: e.target.value })} 
                        placeholder="YYYY-WXX" 
                        style={{ paddingLeft: 46, height: 48, fontSize: 15, fontWeight: 600, borderRadius: 12 }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Streak</label>
                    <div style={{ height: 48, padding: '0 20px', background: 'var(--bg-elevated)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-1)', fontWeight: 700, fontSize: 15, border: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--warning)' }}>🔥</span> {user?.streak || 0} {user?.streak === 1 ? 'Week' : 'Weeks'}
                    </div>
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Reason for Request</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: 16, color: 'var(--text-3)', fontSize: 18 }}>✍️</span>
                    <textarea 
                      className="form-textarea" 
                      value={recoveryForm.reason} 
                      onChange={e => setRecoveryForm({ ...recoveryForm, reason: e.target.value })} 
                      placeholder="Please concisely explain why you missed your submission..." 
                      style={{ paddingLeft: 46, minHeight: 120, paddingTop: 16, fontSize: 14, borderRadius: 12 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex' }}>
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={handleRecoveryRequest}
                    disabled={!recoveryForm.weekId || !recoveryForm.reason}
                    style={{ height: 52, fontSize: 16, borderRadius: 12, boxShadow: '0 4px 16px rgba(7, 108, 4, 0.25)' }}
                  >
                    <span style={{ marginRight: 8, fontSize: 18 }}>✨</span> Submit Recovery Request
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card w-full mx-auto" style={{ maxWidth: 700, padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📜</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{user?.role === 'admin' ? 'All Recovery Requests' : 'Your Recovery Requests'}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Week</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {user?.role === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(streakRecoveries || [])
                    .filter(r => user?.role === 'admin' || r.staffId === user?.id)
                    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
                    .map(r => (
                      <tr key={r.id}>
                        <td>{r.staffName}</td>
                        <td className="font-mono">{r.weekId}</td>
                        <td className="max-w-xs truncate" title={r.reason}>{r.reason}</td>
                        <td>
                          <span className={`badge ${r.status === 'approved' ? 'badge-green' : r.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        {user?.role === 'admin' && r.status === 'pending' && (
                          <td className="flex gap-2">
                            <button className="btn btn-xs btn-green" onClick={() => resolveRecovery(r.id, 'approved')}>Approve</button>
                            <button className="btn btn-xs btn-red" onClick={() => resolveRecovery(r.id, 'rejected')}>Reject</button>
                          </td>
                        )}
                        {user?.role === 'admin' && r.status !== 'pending' && <td className="text-4 text-xs">Reviewed by {r.reviewedBy}</td>}
                      </tr>
                  ))}
                  {(streakRecoveries || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-4">No requests found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showShop && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowShop(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">🛍️ Points Shop</span>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowShop(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Your balance: <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{user?.points || 0} pts</span></div>
                {user?.role === 'admin' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReward(!showAddReward)}>+ Add Reward</button>
                )}
              </div>

              {showAddReward && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Reward Name</label>
                      <input className="form-input" value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Icon</label>
                      <input className="form-input" value={rewardForm.icon} onChange={e => setRewardForm(f => ({ ...f, icon: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={rewardForm.desc} onChange={e => setRewardForm(f => ({ ...f, desc: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost (points)</label>
                    <input className="form-input" type="number" value={rewardForm.cost} onChange={e => setRewardForm(f => ({ ...f, cost: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={addReward}>Add Reward</button>
                </div>
              )}

              <div className="grid-3 mb-8">
                {rewards.filter(r => r.active).map(r => (
                  <div key={r.id} className={`card text-center ${!r.isEnabled ? 'opacity-40 grayscale' : ''}`}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>{r.icon}</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{r.desc}</div>
                    <div className="flex justify-between items-center mb-3 px-4">
                      <span className="text-xs text-4">Stock: {r.stock}</span>
                      <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{r.cost} pts</span>
                    </div>
                    <button
                      className="btn btn-primary btn-sm w-full"
                      disabled={(user?.points || 0) < r.cost || r.stock <= 0 || !r.isEnabled}
                      onClick={() => redeemReward(r)}
                    >
                      {r.stock <= 0 ? 'Out of Stock' : (user?.points || 0) >= r.cost ? 'Redeem' : 'Not enough points'}
                    </button>
                    {user?.role === 'admin' && (
                      <div className="mt-3 flex gap-2">
                        <button className="btn btn-xs btn-secondary flex-1" onClick={() => saveRewards(rewards.map(x => x.id === r.id ? { ...x, stock: x.stock + 5 } : x))}>+5 Stock</button>
                        <button className="btn btn-xs btn-secondary" onClick={() => saveRewards(rewards.map(x => x.id === r.id ? { ...x, isEnabled: !x.isEnabled } : x))}>{r.isEnabled ? 'Disable' : 'Enable'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {user?.role === 'admin' && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="font-bold mb-4">Pending Fullfilment</h3>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Staff</th>
                            <th>Reward</th>
                            <th>Cost</th>
                            <th>Date</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {redeems.filter(r => r.status === 'pending').map(r => (
                            <tr key={r.id}>
                              <td>{r.staffName}</td>
                              <td>{r.rewardName}</td>
                              <td className="font-bold text-accent">{r.cost}</td>
                              <td className="text-xs text-4">{new Date(r.createdAt).toLocaleDateString()}</td>
                              <td>
                                <button className="btn btn-xs btn-accent" onClick={() => fulfillRedeem(r.id)}>Fulfill</button>
                              </td>
                            </tr>
                          ))}
                          {redeems.filter(r => r.status === 'pending').length === 0 && <tr><td colSpan={5} className="text-center py-6 text-4">No pending redemptions</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.action}
        onCancel={() => setConfirmAction({isOpen: false, action: () => {}, message: ''})}
      />
    </div>
  )
}
