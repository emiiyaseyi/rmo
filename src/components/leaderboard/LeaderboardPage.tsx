'use client'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { BADGES, genId, exportCSV, exportPDF, avatarColor, initials } from '../../lib/utils'
import { Staff, Reward, Redemption, PointsHistoryEntry } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import { Trophy, Flame, Medal, Download, ShoppingBag, Award } from 'lucide-react'

const RANK_COLORS = ['var(--gold)', '#9CA3AF', '#B45309']

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
  const { staff, user, entries, rewards, saveRewards, redeems, saveRedeems, awardPoints, notify, settings, leaves, evaluateBadges } = useApp()
  const [tab, setTab] = useState('individual')
  const [showShop, setShowShop] = useState(false)
  const [showAddReward, setShowAddReward] = useState(false)
  const [rewardForm, setRewardForm] = useState({ name: '', desc: '', cost: '', icon: '🎁' })
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

  // Refresh the current user's badges when the Badges tab is opened
  useEffect(() => {
    if (tab === 'badges' && user?.id) evaluateBadges(user.id)
  }, [tab, user?.id])

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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={22} style={{ color: 'var(--brand)' }} /> Leaderboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>Rankings, badges &amp; rewards</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowShop(!showShop)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShoppingBag size={16} /> Points Shop
          </button>
        </div>
      </div>

      {/* Combined banner: your rank (left) + top-3 podium (right) */}
      <div style={{
        background: 'linear-gradient(150deg, var(--brand-2), var(--brand))',
        borderRadius: 'var(--r-lg)', padding: '24px 28px', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 28, boxShadow: 'var(--sh-sm)', flexWrap: 'wrap', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 1px 1px,#fff 1.5px,transparent 0)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
        {/* Your rank */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-sora)'
          }}>
            {myRank > 0 && myRank <= 3 ? <Medal size={30} /> : `#${myRank || '-'}`}
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Your Rank</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-sora)' }}>#{myRank || '-'} <span style={{ fontSize: 15, opacity: 0.7, fontWeight: 600 }}>of {ranked.length}</span></div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              <span style={{ fontFamily: 'var(--mono)' }}>{user?.points || 0}</span> points · <span style={{ fontFamily: 'var(--mono)' }}>{user?.streak || 0}</span> week streak
            </div>
          </div>
        </div>
        {/* Top-3 podium */}
        {ranked.length >= 1 && (() => {
          const top3 = ranked.slice(0, 3)
          const order = [top3[1], top3[0], top3[2]].filter(Boolean) as RankedStaff[]
          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, position: 'relative', zIndex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              {order.map(s => {
                const rank = ranked.findIndex(r => r.id === s.id) + 1
                const isFirst = rank === 1
                const size = isFirst ? 70 : 56
                const isMe = s.id === user?.id
                return (
                  <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 78 }}>
                    <div style={{
                      width: size, height: size, borderRadius: '50%',
                      background: avatarColor(s.name), color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isFirst ? 24 : 19, fontWeight: 800, fontFamily: 'var(--font-sora)',
                      border: isFirst ? '3px solid var(--gold)' : '3px solid rgba(255,255,255,.4)',
                      boxShadow: isFirst ? '0 0 0 4px rgba(255,255,255,.15)' : 'none'
                    }}>{initials(s.name)}</div>
                    <span style={{ padding: '1px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: isFirst ? 'var(--gold)' : 'rgba(255,255,255,.2)', color: isFirst ? '#1a1a1a' : '#fff', fontFamily: 'var(--font-sora)' }}>#{rank}</span>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: isFirst ? 13 : 12, textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name.split(' ')[0]}{isMe ? ' (You)' : ''}</span>
                    <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 11, fontFamily: 'var(--mono)' }}>{(s.points || 0).toLocaleString()} pts</span>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {(() => {
        const pill = (activeP: boolean): React.CSSProperties => ({
          padding: '6px 13px', borderRadius: 999, border: '1px solid',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: activeP ? 'var(--brand)' : 'var(--elev)',
          color: activeP ? '#fff' : 'var(--ink-2)',
          borderColor: activeP ? 'var(--brand)' : 'var(--line)',
        })
        const PERIODS: PeriodType[] = ['alltime', 'week', 'month', 'custom']
        const plabel = (p: PeriodType) => p === 'alltime' ? 'All Time' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom'
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
            {/* Tabs (left) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['individual', 'reviewal', 'department', 'badges'] as const).map(t => {
                const active = tab === t
                const label = t === 'individual' ? 'Submission' : t === 'reviewal' ? 'Reviewal' : t === 'department' ? 'Departments' : 'Badges'
                const Icon = t === 'individual' ? Trophy : t === 'reviewal' ? Award : t === 'department' ? Medal : Award
                return (
                  <button key={t} onClick={() => setTab(t)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: active ? 'var(--tint)' : 'transparent', color: active ? 'var(--brand)' : 'var(--ink-3)',
                    borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent', marginBottom: -6, transition: 'all .15s'
                  }}><Icon size={15} /> {label}</button>
                )
              })}
            </div>

            {/* Filters (right) — Submission tab */}
            {tab === 'individual' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {PERIODS.map(p => <button key={p} onClick={() => setPeriodType(p)} style={pill(periodType === p)}>{plabel(p)}</button>)}
                {periodType === 'week' && (
                  <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={selectedWeek} onChange={e => { setSelectedWeek(e.target.value); periodFetchKey.current = '' }}>
                    {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                )}
                {periodType === 'month' && (
                  <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); periodFetchKey.current = '' }}>
                    {availableMonths.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
                  </select>
                )}
                {periodType === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" className="form-input" style={{ width: 'auto' }} value={customFrom} max={customTo || undefined} onChange={e => { setCustomFrom(e.target.value); periodFetchKey.current = '' }} />
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>to</span>
                    <input type="date" className="form-input" style={{ width: 'auto' }} value={customTo} min={customFrom || undefined} onChange={e => { setCustomTo(e.target.value); periodFetchKey.current = '' }} />
                  </div>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Download size={14} /> CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Download size={14} /> PDF</button>
              </div>
            )}

            {/* Filters (right) — Reviewal tab */}
            {tab === 'reviewal' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {PERIODS.map(p => <button key={p} onClick={() => setReviewPeriodType(p)} style={pill(reviewPeriodType === p)}>{plabel(p)}</button>)}
                {reviewPeriodType === 'week' && (
                  <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={reviewSelectedWeek} onChange={e => setReviewSelectedWeek(e.target.value)}>
                    {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                )}
                {reviewPeriodType === 'month' && (
                  <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={reviewSelectedMonth} onChange={e => setReviewSelectedMonth(e.target.value)}>
                    {availableMonths.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
                  </select>
                )}
                {reviewPeriodType === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" className="form-input" style={{ width: 'auto' }} value={reviewCustomFrom} max={reviewCustomTo || undefined} onChange={e => setReviewCustomFrom(e.target.value)} />
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>to</span>
                    <input type="date" className="form-input" style={{ width: 'auto' }} value={reviewCustomTo} min={reviewCustomFrom || undefined} onChange={e => setReviewCustomTo(e.target.value)} />
                  </div>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => handleReviewExport('csv')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Download size={14} /> CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleReviewExport('pdf')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Download size={14} /> PDF</button>
              </div>
            )}
          </div>
        )
      })()}

      {tab === 'individual' && (
        <div className="flex flex-col gap-4" style={{ paddingBottom: 4 }}>
          {periodType !== 'alltime' && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {periodLoading ? 'Loading…'
                : periodType === 'week' ? `Showing points earned week of ${selectedWeek}`
                : periodType === 'month' ? `Showing points earned in ${new Date((selectedMonth || '2000-01') + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
                : customFrom && customTo ? `Showing points earned ${customFrom} → ${customTo}`
                : 'Pick a start and end date'}
            </div>
          )}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Rank</th>
                    <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Member</th>
                    <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Department</th>
                    <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Streak</th>
                    <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 25).map((s, i) => {
                    const isMe = s.id === user?.id
                    const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--ink-3)'
                    return (
                      <tr key={s.id} style={isMe ? { background: 'var(--tint)' } : undefined}>
                        <td style={{ fontFamily: 'var(--font-sora)', fontWeight: 800, fontSize: 16, color: rankColor }}>
                          {i + 1}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                             <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(s.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                {initials(s.name)}
                             </div>
                            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{s.name}{isMe ? <span style={{ color: 'var(--brand)' }}> (You)</span> : ''}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--ink-3)', fontSize: 13 }}>{s.department || '—'}</td>
                        <td>
                          {s.streak
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gold)', fontWeight: 600 }}><Flame size={14} /> {s.streak}</span>
                            : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--brand)' }}>{(s.points || 0).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--elev)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', fontSize: 12, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Scoring rubric:</span>
            {[
              { score: 3, label: `Early (within ${settings?.pointsConfig?.earlySubmissionHours ?? 4}h of window opening) · +4 after 3 consecutive early weeks`, color: 'var(--success)' },
              { score: 2, label: 'On-time (within submission window)', color: 'var(--brand)' },
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
        {reviewPeriodType !== 'alltime' && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {reviewPeriodType === 'week' ? `Showing reviews week of ${reviewSelectedWeek}`
              : reviewPeriodType === 'month' ? `Showing reviews in ${new Date((reviewSelectedMonth || '2000-01') + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
              : reviewCustomFrom && reviewCustomTo ? `Showing reviews ${reviewCustomFrom} → ${reviewCustomTo}`
              : 'Pick a start and end date'}
          </div>
        )}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Rank</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Reviewer</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Reviewed</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }} title="Avg score based on review speed: 100 within submission window, 80 within 2h after, 60 within 24h, 0 after 24h">Avg Score</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {reviewalRanked.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>No review data yet</td></tr>
                )}
                {reviewalRanked.map((s, i) => {
                  const scoreColor = s.avgScore >= 80 ? 'var(--success)' : s.avgScore >= 40 ? 'var(--warning)' : s.totalReviewed > 0 ? 'var(--danger)' : 'var(--ink-3)'
                  const scoreLabel = s.avgScore === 100 ? 'Excellent' : s.avgScore >= 80 ? 'Great' : s.avgScore >= 60 ? 'Good' : s.avgScore >= 40 ? 'Fair' : s.avgScore > 0 ? 'Slow' : '—'
                  const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--ink-3)'
                  return (
                    <tr key={s.id} style={s.id === user?.id ? { background: 'var(--tint)' } : undefined}>
                      <td style={{ fontFamily: 'var(--font-sora)', fontWeight: 800, fontSize: 16, color: rankColor }}>{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(s.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials(s.name)}</div>
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{s.name}{s.id === user?.id ? <span style={{ color: 'var(--brand)' }}> (You)</span> : ''}</span>
                            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.department} · {s.role.replace('_', ' ')}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{s.totalReviewed}</td>
                      <td>
                        {s.totalReviewed === 0
                          ? <span style={{ color: 'var(--ink-4)' }}>—</span>
                          : <span style={{ fontWeight: 800, color: scoreColor, fontFamily: 'var(--mono)', fontSize: 16 }}>{s.avgScore}</span>
                        }
                      </td>
                      <td>
                        {s.totalReviewed === 0 ? <span style={{ color: 'var(--ink-4)' }}>—</span> : (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--elev)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', fontSize: 12, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Scoring rubric:</span>
          {[
            { score: 100, label: 'Within submission window', color: 'var(--success)' },
            { score: 80, label: '≤ 2h after window closes', color: 'var(--brand)' },
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Rank</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Department</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Members</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Avg Points</th>
                  <th style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>Avg Submit Rate</th>
                </tr>
              </thead>
              <tbody>
                {deptRanked.map((d, i) => (
                  <tr key={d.dept}>
                    <td style={{ fontFamily: 'var(--font-sora)', fontWeight: 800, fontSize: 16, color: i < 3 ? RANK_COLORS[i] : 'var(--ink-3)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{d.dept}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{d.members}</td>
                    <td style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: 'var(--mono)' }}>{d.avgPts}</td>
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
              <div key={badge.id} className="flex items-center gap-4" style={{
                background: earned ? 'var(--tint)' : 'var(--surface)',
                border: earned ? '1px solid var(--brand)' : '1px solid var(--line)',
                borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', padding: 16,
                opacity: earned ? 1 : 0.55, filter: earned ? 'none' : 'grayscale(1)'
              }}>
                <div className="text-4xl">{badge.icon}</div>
                <div className="flex-1">
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{badge.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{badge.desc}</div>
                  {!earned && <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 4, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Earn: {badge.id.replace(/_/g, ' ')}...</div>}
                </div>
                {earned && <div style={{ color: 'var(--brand)', fontWeight: 800 }}>✓</div>}
              </div>
            )
          })}
        </div>
      )}

      {showShop && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowShop(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ShoppingBag size={18} /> Points Shop</span>
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
