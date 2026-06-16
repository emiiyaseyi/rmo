'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { getWeekKey, weekRange, exportCSV, exportPDF } from '../../lib/utils'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, subWeeks, eachWeekOfInterval, startOfDay, endOfDay } from 'date-fns'
import TimeReport from './TimeReport'
import { Clock, CheckCircle2, AlertCircle, Users, TrendingUp, TrendingDown, Download } from 'lucide-react'

type PeriodType = 'week' | 'month' | 'custom'

export default function AnalyticsPage() {
  const { staff, entries, settings, projects, projectBudgets, user } = useApp()
  const [tab, setTab] = useState('overview')

  const isTeamLead = user?.role === 'team_lead'

  // Filter State
  const [periodType, setPeriodType] = useState<PeriodType>('week')
  const [selectedWeek, setSelectedWeek] = useState(getWeekKey())
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [customStart, setCustomStart] = useState(format(subWeeks(new Date(), 4), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [staffFilter, setStaffFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  // Utils
  const weekCap = settings?.weekly_cap || 45
  // Team leads only see staff they manage (plus themselves)
  const scopedStaff = isTeamLead
    ? staff.filter(s => s.leadId === user?.id || s.id === user?.id)
    : staff
  const activeStaff = scopedStaff.filter(s => !s.suspended)
  const departments = Array.from(new Set(activeStaff.map(s => s.department).filter(Boolean).map(d => d as string))).sort()

  // Date Range Calculation
  const dateRange = useMemo(() => {
    let start: Date, end: Date
    if (periodType === 'week') {
      start = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 })
      end = endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 })
    } else if (periodType === 'month') {
      start = startOfMonth(parseISO(selectedMonth + '-01'))
      end = endOfMonth(parseISO(selectedMonth + '-01'))
    } else {
      start = startOfDay(parseISO(customStart))
      end = endOfDay(parseISO(customEnd))
    }
    return { start, end }
  }, [periodType, selectedWeek, selectedMonth, customStart, customEnd])

  // Scoped entries: team leads only see entries for their managed staff
  const scopedStaffIds = useMemo(() => new Set(scopedStaff.map(s => s.id)), [scopedStaff])
  const scopedEntries = useMemo(() => {
    if (!isTeamLead) return entries
    return entries.filter(e => scopedStaffIds.has(e.staffId))
  }, [entries, isTeamLead, scopedStaffIds])

  // Filtered Data
  const filteredEntries = useMemo(() => {
    return scopedEntries.filter(e => {
      if (e.deleted) return false
      // Use date → startDate → weekKey as fallback (weekKey is always present)
      const dateStr = e.date || e.startDate || e.weekKey
      if (!dateStr) return false
      try {
        const d = parseISO(dateStr)
        return isWithinInterval(d, { start: dateRange.start, end: dateRange.end })
      } catch {
        return false
      }
    })
  }, [scopedEntries, dateRange])

  const filteredStaff = useMemo(() => {
    return activeStaff.filter(s => {
      const matchStaff = !staffFilter || s.name.toLowerCase().includes(staffFilter.toLowerCase())
      const matchDept = !deptFilter || s.department === deptFilter
      return matchStaff && matchDept
    })
  }, [activeStaff, staffFilter, deptFilter])

  // Overview Stats
  const stats = useMemo(() => {
    const approved = filteredEntries.filter(e => e.status === 'approved')
    const submitted = filteredEntries.filter(e => ['submitted', 'resubmitted', 'approved', 'pending_2nd_approval'].includes(e.status))
    const pending = filteredEntries.filter(e => ['submitted', 'resubmitted', 'pending_2nd_approval'].includes(e.status))
    
    const totalHours = approved.reduce((sum, e) => sum + (e.hours || 0), 0)
    // Rate = approved out of all submitted (including still-pending), so 46 pending pulls it down correctly
    const approvalRate = submitted.length > 0 ? Math.round((approved.length / submitted.length) * 100) : 0
    
    const staffWithEntries = Array.from(new Set(filteredEntries.map(e => e.staffId)))
    const activeStaffCount = staffWithEntries.length
    // Not-submitted: for week view use selectedWeek directly (avoids UTC timezone shift from getWeekKey).
    // For month/custom, check staff who have no qualifying entry in any week within the range.
    let notSubmittedList: typeof activeStaff
    if (periodType === 'week') {
      const submittedSet = new Set(
        scopedEntries.filter(e =>
          e.weekKey === selectedWeek &&
          ['submitted', 'approved', 'resubmitted', 'pending_2nd_approval'].includes(e.status) &&
          !e.deleted
        ).map(e => e.staffId)
      )
      notSubmittedList = activeStaff.filter(s => !submittedSet.has(s.id) && !s.exemptFromTimesheet)
    } else {
      const submittedSet = new Set(
        scopedEntries.filter(e =>
          ['submitted', 'approved', 'resubmitted', 'pending_2nd_approval'].includes(e.status) &&
          !e.deleted
        ).map(e => e.staffId)
      )
      notSubmittedList = activeStaff.filter(s => !submittedSet.has(s.id) && !s.exemptFromTimesheet)
    }

    return {
      totalHours: parseFloat(totalHours.toFixed(1)),
      approvalRate,
      pendingCount: pending.length,
      activeStaffCount,
      notSubmittedList
    }
  }, [filteredEntries, activeStaff, scopedEntries, dateRange, periodType, selectedWeek])

  // Bar chart - hours logged across last 5 weeks
  const last5WeeksData = useMemo(() => {
    const weeks: any[] = []
    const end = dateRange.end
    const start = subWeeks(end, 4)
    const interval = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })

    interval.forEach(w => {
      // Use format() to get YYYY-MM-DD in local time (avoids UTC offset shifting the day)
      const wKey = format(w, 'yyyy-MM-dd')
      const wEntries = scopedEntries.filter(e => e.weekKey === wKey && e.status === 'approved' && !e.deleted)
      weeks.push({
        week: format(w, 'dd MMM'),
        hours: parseFloat(wEntries.reduce((s, e) => s + (e.hours || 0), 0).toFixed(1))
      })
    })
    return weeks.slice(-5)
  }, [scopedEntries, dateRange])

  // Weekly breakdown table
  const weeklyBreakdown = useMemo(() => {
    const weeksMap: Record<string, any> = {}
    filteredEntries.forEach(e => {
      if (!weeksMap[e.weekKey]) {
        weeksMap[e.weekKey] = { weekKey: e.weekKey, entries: 0, hours: 0, approved: 0, pending: 0, rejected: 0 }
      }
      const w = weeksMap[e.weekKey]
      w.entries++
      w.hours += e.hours || 0
      if (e.status === 'approved') w.approved++
      else if (['submitted', 'resubmitted', 'pending_2nd_approval'].includes(e.status)) w.pending++
      else if (e.status === 'rejected') w.rejected++
    })

    return Object.values(weeksMap).map(w => {
      const decided = w.approved + w.rejected
      return {
        ...w,
        hours: parseFloat(w.hours.toFixed(1)),
        approvalRate: decided > 0 ? Math.round((w.approved / decided) * 100) : 0
      }
    }).sort((a, b) => b.weekKey.localeCompare(a.weekKey))
  }, [filteredEntries])

  // Month Comparison Data
  const monthCompareData = useMemo(() => {
    const currentMonthStart = startOfMonth(dateRange.start)
    const prevMonthStart = startOfMonth(subWeeks(currentMonthStart, 4)) // Roughly previous month
    const prevMonthEnd = endOfMonth(prevMonthStart)

    const getMonthStats = (start: Date, end: Date) => {
      const ents = scopedEntries.filter(e => {
        if (e.deleted) return false
        const dateStr = e.date || e.startDate || e.weekKey
        if (!dateStr) return false
        try { return isWithinInterval(parseISO(dateStr), { start, end }) } catch { return false }
      })
      const approved = ents.filter(e => e.status === 'approved')
      const hours = approved.reduce((sum, e) => sum + (e.hours || 0), 0)
      const submissionCount = new Set(ents.map(e => `${e.staffId}-${e.weekKey}`)).size
      return { hours: parseFloat(hours.toFixed(1)), submissions: submissionCount }
    }

    const current = getMonthStats(currentMonthStart, endOfMonth(currentMonthStart))
    const previous = getMonthStats(prevMonthStart, prevMonthEnd)

    return { current, previous }
  }, [scopedEntries, dateRange.start])

  // Utilisation Data
  const utilisationData = useMemo(() => {
    // Determine number of weeks in period for averaging
    const days = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    const weeksInPeriod = Math.max(days / 7, 1)
    const lowThresh = settings?.utilizationThresholds?.low || 25
    const highThresh = settings?.utilizationThresholds?.high || 40

    return filteredStaff.map(s => {
      const sEntries = filteredEntries.filter(e => e.staffId === s.id && e.status === 'approved')
      const totalHours = sEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      const avgWeekly = totalHours / weeksInPeriod
      const utilization = Math.round((avgWeekly / weekCap) * 100)
      
      return {
        ...s,
        totalHours: parseFloat(totalHours.toFixed(1)),
        avgWeekly: parseFloat(avgWeekly.toFixed(1)),
        utilization,
        isUnder: avgWeekly < lowThresh && totalHours > 0,
        isOver: avgWeekly > highThresh
      }
    }).sort((a, b) => b.avgWeekly - a.avgWeekly)
  }, [filteredStaff, filteredEntries, weekCap, dateRange, settings])

  // Hours by department (derived from filtered approved entries + scoped staff)
  const hoursByDept = useMemo(() => {
    const map: Record<string, number> = {}
    filteredEntries
      .filter(e => e.status === 'approved')
      .forEach(e => {
        const s = scopedStaff.find(st => st.id === e.staffId)
        const dept = s?.department || 'Unassigned'
        map[dept] = (map[dept] || 0) + (e.hours || 0)
      })
    const rows = Object.entries(map)
      .map(([dept, hours]) => ({ dept, hours: parseFloat(hours.toFixed(1)) }))
      .sort((a, b) => b.hours - a.hours)
    const max = Math.max(...rows.map(r => r.hours), 1)
    return rows.map(r => ({ ...r, pct: Math.round((r.hours / max) * 100) }))
  }, [filteredEntries, scopedStaff])

  // Weekly submission rate (derived from weeklyBreakdown approval rate per week)
  const weeklySubmissionRate = useMemo(() => {
    return last5WeeksData.map(w => {
      const wk = weeklyBreakdown.find(b => format(parseISO(b.weekKey), 'dd MMM') === w.week)
      return { week: w.week, rate: wk ? wk.approvalRate : 0 }
    })
  }, [last5WeeksData, weeklyBreakdown])

  // Staff YTD Data
  const staffYTD = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const yearEnd = new Date()
    const ytdEntries = scopedEntries.filter(e => {
      if (e.deleted) return false
      const dateStr = e.date || e.startDate || e.weekKey
      if (!dateStr) return false
      try { return parseISO(dateStr) >= yearStart } catch { return false }
    })
    
    return activeStaff.map(s => {
      const sEntries = ytdEntries.filter(e => e.staffId === s.id)
      const approved = sEntries.filter(e => e.status === 'approved')
      const totalHours = approved.reduce((sum, e) => sum + (e.hours || 0), 0)
      
      // Submit rate: weeks with entries / weeks in year so far
      const weeksSoFar = eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 })
      const weeksWithEntries = new Set(sEntries.map(e => e.weekKey)).size
      const submitRate = Math.round((weeksWithEntries / weeksSoFar.length) * 100)
      
      return {
        ...s,
        ytdHours: parseFloat(totalHours.toFixed(1)),
        submitRate,
        weeksActive: weeksWithEntries
      }
    }).sort((a, b) => b.ytdHours - a.ytdHours)
  }, [activeStaff, scopedEntries])

  // Tab switching and exports
  const exportNotSubmitted = () => {
    const rows = stats.notSubmittedList.map(s => ({
      Name: s.name,
      Email: s.email,
      Department: s.department || '—',
      Lead: s.leadName || '—'
    }))
    exportCSV(rows, `not_submitted_${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}.csv`)
    toast.success('Exported not-submitted list')
  }

  const exportUtilisation = () => {
    const columns = [
      { key: 'name', label: 'Staff Name' },
      { key: 'dept', label: 'Department' },
      { key: 'total', label: 'Total Hrs' },
      { key: 'avg', label: 'Avg Weekly' },
      { key: 'util', label: 'Util %' }
    ]
    const rows = utilisationData.map(u => ({
      name: u.name,
      dept: u.department || '—',
      total: u.totalHours + 'h',
      avg: u.avgWeekly + 'h',
      util: u.utilization + '%'
    }))
    exportPDF(rows, columns, 'Staff Utilisation Report', `utilisation_${format(dateRange.start, 'yyyy-MM-dd')}.pdf`)
    toast.success('Generated Utilisation PDF')
  }

  const exportYTD = () => {
    const rows = staffYTD.map(s => ({
      Name: s.name,
      Department: s.department || '—',
      'YTD Hours': s.ytdHours,
      'Submit Rate %': s.submitRate,
      'Weeks Active': s.weeksActive
    }))
    exportCSV(rows, `staff_ytd_${new Date().getFullYear()}.csv`)
    toast.success('Exported YTD CSV')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">📊 Analytics & Reports</h1>
          <p className="page-subtitle">Visibility into timesheet activity, staff utilisation, and project progress.</p>
        </div>

        {/* Global Period Filter */}
        <div className="card card-sm flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-elevated rounded-lg p-1">
            {(['week', 'month', 'custom'] as PeriodType[]).map(t => (
              <button
                key={t}
                onClick={() => setPeriodType(t)}
                className={`btn btn-sm ${periodType === t ? 'btn-primary' : 'btn-secondary border-none'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </div>

          {periodType === 'week' && (
            <input
              type="week"
              className="form-input"
              style={{ width: 180 }}
              value={selectedWeek.includes('-W') ? selectedWeek : format(parseISO(selectedWeek), "yyyy-'W'II")}
              onChange={e => {
                const [yStr, wStr] = e.target.value.split('-W')
                if (yStr && wStr) {
                  const y = parseInt(yStr)
                  const w = parseInt(wStr)
                  const target = startOfWeek(new Date(y, 0, 1 + (w - 1) * 7), { weekStartsOn: 1 })
                  setSelectedWeek(getWeekKey(target))
                }
              }}
            />
          )}

          {periodType === 'month' && (
            <input
              type="month"
              className="form-input"
              style={{ width: 160 }}
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
          )}

          {periodType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="form-input"
                style={{ width: 140 }}
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span className="text-4">to</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 140 }}
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(isTeamLead
          ? ['time_report', 'overview', 'utilisation', 'hour_thresholds']
          : ['overview', 'time_report', 'dept_report', 'projects', 'utilisation', 'hour_thresholds', 'staff_ytd', 'month_compare']
        ).map(t => (
          <div
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t.replace(/_/g, ' ')}
          </div>
        ))}
      </div>

      {/* ── TIME REPORT TAB ── */}
      {tab === 'time_report' && (
        <TimeReport
          entries={filteredEntries}
          staff={activeStaff}
          projects={projects}
          dateRange={dateRange}
        />
      )}
      {tab === 'overview' && (() => {
        const orgSubmissionRate = activeStaff.length > 0
          ? Math.round(((activeStaff.length - stats.notSubmittedList.length) / activeStaff.length) * 100)
          : 0
        const labelStyle: React.CSSProperties = {
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)'
        }
        const numberStyle: React.CSSProperties = {
          fontFamily: 'var(--font-sora)', fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, marginTop: 8
        }
        const cardStyle: React.CSSProperties = {
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--sh-sm)'
        }
        const Delta = ({ up, children }: { up: boolean; children: React.ReactNode }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: up ? 'var(--brand)' : 'var(--danger)' }}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <span>{children}</span>
          </div>
        )
        const kpis = [
          {
            label: 'Total Hours', icon: <Clock size={15} style={{ color: 'var(--ink-4)' }} />,
            value: `${stats.totalHours}h`,
            delta: <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>Approved in period</div>
          },
          {
            label: 'Approval Rate', icon: <CheckCircle2 size={15} style={{ color: 'var(--ink-4)' }} />,
            value: `${stats.approvalRate}%`,
            delta: <Delta up={stats.approvalRate >= 80}>Of submitted entries</Delta>
          },
          {
            label: 'On-Time Rate', icon: <Users size={15} style={{ color: 'var(--ink-4)' }} />,
            value: `${orgSubmissionRate}%`,
            delta: <Delta up={orgSubmissionRate >= 80}>{stats.notSubmittedList.length} not submitted</Delta>
          },
          {
            label: 'Active Staff', icon: <AlertCircle size={15} style={{ color: 'var(--ink-4)' }} />,
            value: `${stats.activeStaffCount}`,
            delta: <div style={{ marginTop: 8, fontSize: 12, color: stats.pendingCount > 0 ? 'var(--warn)' : 'var(--ink-3)' }}>{stats.pendingCount} pending review</div>
          },
        ]
        return (
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {kpis.map(k => (
              <div key={k.label} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={labelStyle}>{k.label}</span>
                  {k.icon}
                </div>
                <div style={numberStyle}>{k.value}</div>
                {k.delta}
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Hours by department */}
            <div style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>Hours by department</h3>
              {hoursByDept.length === 0 ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No data for this period.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {hoursByDept.map(d => (
                    <div key={d.dept} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 88, flexShrink: 0, fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.dept}>{d.dept}</span>
                      <div style={{ flex: 1, height: 24, background: 'var(--line-2)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${d.pct}%`, background: 'var(--brand)', borderRadius: 6, transition: 'width .3s' }} />
                      </div>
                      <span style={{ width: 56, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)' }}>{d.hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly submission rate */}
            <div style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>Weekly submission rate</h3>
              {weeklySubmissionRate.length === 0 ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No data for this period.</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200, paddingTop: 8 }}>
                  {weeklySubmissionRate.map(w => (
                    <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>{w.rate}%</span>
                      <div style={{ width: '100%', height: `${Math.max(w.rate, 2)}%`, background: w.rate < 50 ? 'var(--warn)' : 'var(--brand)', borderRadius: '6px 6px 0 0', transition: 'height .3s' }} />
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{w.week}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Utilisation by team table */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>Utilisation by team</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    {['Department', 'Members', 'Avg hrs/week', 'Utilisation'].map((h, i) => (
                      <th key={h} style={{ ...labelStyle, textAlign: i === 0 ? 'left' : 'right', padding: '0 12px 10px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const deptAgg: Record<string, { members: Set<string>; hours: number; util: number; n: number }> = {}
                    utilisationData.forEach(u => {
                      const dept = u.department || 'Unassigned'
                      if (!deptAgg[dept]) deptAgg[dept] = { members: new Set(), hours: 0, util: 0, n: 0 }
                      deptAgg[dept].members.add(u.id)
                      deptAgg[dept].hours += u.avgWeekly
                      deptAgg[dept].util += u.utilization
                      deptAgg[dept].n++
                    })
                    const rows = Object.entries(deptAgg)
                      .map(([dept, d]) => ({
                        dept,
                        members: d.members.size,
                        avgHrs: parseFloat((d.hours / Math.max(d.n, 1)).toFixed(1)),
                        util: Math.round(d.util / Math.max(d.n, 1)),
                      }))
                      .sort((a, b) => b.util - a.util)
                    if (rows.length === 0) {
                      return <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-4)', fontSize: 13 }}>No data for this period.</td></tr>
                    }
                    return rows.map(r => (
                      <tr key={r.dept} style={{ borderBottom: '1px solid var(--line-2)' }}>
                        <td style={{ padding: '12px', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{r.dept}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)' }}>{r.members}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)' }}>{r.avgHrs}h</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                            <div style={{ width: 90, height: 8, background: 'var(--line-2)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(r.util, 100)}%`, background: r.util > 100 ? 'var(--danger)' : r.util < 50 ? 'var(--warn)' : 'var(--brand)', borderRadius: 4 }} />
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', width: 38, textAlign: 'right' }}>{r.util}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Not-submitted list (logic + export preserved) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Not-submitted list</h3>
              <button className="btn btn-secondary btn-sm" onClick={exportNotSubmitted} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Export CSV</button>
            </div>
            <div className="table-wrap" style={{ maxHeight: 250 }}>
              <table>
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.notSubmittedList.length === 0 ? (
                    <tr><td colSpan={2} className="text-center py-8 text-4">All staff submitted! 🎉</td></tr>
                  ) : (
                    stats.notSubmittedList.map(s => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td className="text-3">{s.department || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="text-1 font-bold mb-4">Weekly Breakdown</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Week Range</th>
                    <th>Entries</th>
                    <th>Hours</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Rejected</th>
                    <th>Approval Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyBreakdown.map(w => (
                    <tr key={w.weekKey}>
                      <td className="font-medium">{weekRange(w.weekKey)}</td>
                      <td>{w.entries}</td>
                      <td className="font-bold">{w.hours}h</td>
                      <td className="text-success">{w.approved}</td>
                      <td className="text-warning">{w.pending}</td>
                      <td className="text-danger">{w.rejected}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress flex-1" style={{ width: 60 }}>
                            <div className="progress-bar" style={{ width: `${w.approvalRate}%`, backgroundColor: w.approvalRate >= 80 ? 'var(--success)' : 'var(--warning)' }} />
                          </div>
                          <span className="text-xs">{w.approvalRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ── DEPARTMENT REPORT TAB ── */}
      {tab === 'dept_report' && (() => {
        // Group filtered entries by department, then by project, then by category/task
        const deptMap: Record<string, { hours: number; entries: number; projects: Record<string, { hours: number; entries: number; categories: Record<string, number> }> }> = {}
        filteredEntries.forEach(e => {
          const s = staff.find(st => st.id === e.staffId)
          const dept = s?.department || 'Unassigned'
          if (!deptMap[dept]) deptMap[dept] = { hours: 0, entries: 0, projects: {} }
          deptMap[dept].hours += e.hours || 0
          deptMap[dept].entries++
          if (!deptMap[dept].projects[e.project]) deptMap[dept].projects[e.project] = { hours: 0, entries: 0, categories: {} }
          deptMap[dept].projects[e.project].hours += e.hours || 0
          deptMap[dept].projects[e.project].entries++
          const cat = e.category || 'General'
          deptMap[dept].projects[e.project].categories[cat] = (deptMap[dept].projects[e.project].categories[cat] || 0) + (e.hours || 0)
        })
        const sorted = Object.entries(deptMap).sort((a, b) => b[1].hours - a[1].hours)
        
        const exportDeptCSV = () => {
          const rows: any[] = []
          sorted.forEach(([dept, d]) => {
            Object.entries(d.projects).forEach(([proj, p]) => {
              Object.entries(p.categories).forEach(([cat, h]) => {
                rows.push({ Department: dept, Project: proj, Task: cat, Hours: h.toFixed(1), Entries: p.entries })
              })
            })
          })
          exportCSV(rows, `dept_report_${format(dateRange.start, 'yyyy-MM-dd')}.csv`)
          toast.success('CSV exported')
        }

        return (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-1 font-bold">Department / Project / Task Report</h3>
              <button className="btn btn-secondary btn-sm" onClick={exportDeptCSV}>⬇ Export CSV</button>
            </div>
            {sorted.length === 0 ? (
              <div className="empty-state card"><div className="empty-state-icon">📊</div><div>No data for this period.</div></div>
            ) : sorted.map(([dept, d]) => (
              <div key={dept} className="card flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-base">{dept}</h4>
                    <span className="text-xs text-3">{d.entries} entries · {d.hours.toFixed(1)}h total</span>
                  </div>
                  <div className="progress" style={{ width: 120 }}>
                    <div className="progress-bar" style={{ width: `${Math.min((d.hours / Math.max(...sorted.map(s => s[1].hours))) * 100, 100)}%` }} />
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Project</th><th>Task / Category</th><th>Hours</th></tr></thead>
                    <tbody>
                      {Object.entries(d.projects).sort((a, b) => b[1].hours - a[1].hours).map(([proj, p]) =>
                        Object.entries(p.categories).sort((a, b) => b[1] - a[1]).map(([cat, h], i) => (
                          <tr key={`${proj}-${cat}`}>
                            {i === 0 ? <td className="font-medium" rowSpan={Object.keys(p.categories).length}>{proj}</td> : null}
                            <td className="text-xs text-3">{cat}</td>
                            <td className="font-bold font-mono">{h.toFixed(1)}h</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── HOUR THRESHOLDS TAB ── */}
      {tab === 'hour_thresholds' && (() => {
        const lowThresh = settings?.utilizationThresholds?.low || 25
        const highThresh = settings?.utilizationThresholds?.high || 40
        const days = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
        const weeksInPeriod = Math.max(days / 7, 1)

        const COUNTED_STATUSES = ['submitted', 'approved', 'resubmitted', 'pending_2nd_approval', 'pending_clarification']
        const staffWithHours = activeStaff.map(s => {
          const sEntries = filteredEntries.filter(e => e.staffId === s.id && COUNTED_STATUSES.includes(e.status))
          const totalHours = sEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
          const avgWeekly = totalHours / weeksInPeriod
          return { ...s, totalHours: parseFloat(totalHours.toFixed(1)), avgWeekly: parseFloat(avgWeekly.toFixed(1)) }
        })

        const overStaff = staffWithHours.filter(s => s.avgWeekly > highThresh).sort((a, b) => b.avgWeekly - a.avgWeekly)
        const underStaff = staffWithHours.filter(s => s.avgWeekly < lowThresh && s.totalHours > 0).sort((a, b) => a.avgWeekly - b.avgWeekly)

        const exportThresholds = (list: typeof staffWithHours, label: string) => {
          exportCSV(list.map(s => ({ Name: s.name, Department: s.department || '—', TotalHours: s.totalHours, AvgWeekly: s.avgWeekly })), `${label}_${format(dateRange.start, 'yyyy-MM-dd')}.csv`)
          toast.success('Exported')
        }

        const StaffTable = ({ data, label, color }: { data: typeof staffWithHours; label: string; color: string }) => (
          <div className="card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold" style={{ color }}>{label} <span className="badge" style={{ background: color + '22', color }}>{data.length}</span></h4>
              <button className="btn btn-secondary btn-sm" onClick={() => exportThresholds(data, label.toLowerCase().replace(/\s+/g, '_'))}>⬇ Export CSV</button>
            </div>
            {data.length === 0 ? (
              <div className="text-center py-8 text-4 italic">No staff in this category</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Staff</th><th>Department</th><th>Avg Weekly</th><th>Total Hours</th></tr></thead>
                  <tbody>
                    {data.map(s => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-3">{s.department || '—'}</td>
                        <td className="font-bold" style={{ color }}>{s.avgWeekly}h</td>
                        <td className="font-mono text-3">{s.totalHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

        return (
          <div className="flex flex-col gap-6">
            <div className="grid-2 gap-3">
              <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
                <div className="stat-label">Over Hours (&gt;{highThresh}h/wk)</div>
                <div className="stat-value text-danger">{overStaff.length}</div>
                <div className="stat-sub">staff above threshold</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'var(--warning)' }}>
                <div className="stat-label">Under Hours (&lt;{lowThresh}h/wk)</div>
                <div className="stat-value text-warning">{underStaff.length}</div>
                <div className="stat-sub">staff below threshold</div>
              </div>
            </div>
            <StaffTable data={overStaff} label={`Over ${highThresh}h Staff`} color="var(--danger)" />
            <StaffTable data={underStaff} label={`Under ${lowThresh}h Staff`} color="var(--warning)" />
          </div>
        )
      })()}

      {/* ── PROJECTS TAB ── */}
      {tab === 'projects' && (
        <div className="flex flex-col gap-6">
          <div className="grid-3">
            {projects.map(p => {
              const budget = projectBudgets.find(b => b.projectId === p.id)
              const budgetHrs = budget?.budgetHours || 0
              // Calculate logged hours for this project in the selected period
              const loggedHrs = filteredEntries
                .filter(e => e.project === p.name && e.status === 'approved')
                .reduce((sum, e) => sum + (e.hours || 0), 0)
              
              const percent = budgetHrs > 0 ? Math.min(Math.round((loggedHrs / budgetHrs) * 100), 100) : 0
              
              return (
                <div key={p.id} className="card flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-1 truncate" title={p.name}>{p.name}</h3>
                    <span className="text-xs font-mono text-3">{loggedHrs}h / {budgetHrs || '∞'}h</span>
                  </div>
                  <div className="progress">
                    <div 
                      className={`progress-bar ${percent > 90 ? 'danger' : percent > 70 ? 'warning' : ''}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={percent > 90 ? 'text-danger font-bold' : 'text-3'}>{percent}% used</span>
                    <span className="text-4">{budgetHrs ? `${budgetHrs - loggedHrs}h left` : 'No budget set'}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <h3 className="text-1 font-bold mb-4">Project Performance Summary</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Budget Hours</th>
                    <th>Actual Logged</th>
                    <th>Progress</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    const budget = projectBudgets.find(b => b.projectId === p.id)
                    const budgetHrs = budget?.budgetHours || 0
                    const loggedHrs = filteredEntries
                      .filter(e => e.project === p.name && e.status === 'approved')
                      .reduce((sum, e) => sum + (e.hours || 0), 0)
                    const percent = budgetHrs > 0 ? (loggedHrs / budgetHrs) * 100 : 0
                    
                    return (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="font-mono text-3">{budgetHrs || '—'}</td>
                        <td className="font-bold">{loggedHrs}h</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="progress flex-1" style={{ minWidth: 100 }}>
                              <div className="progress-bar" style={{ width: `${Math.min(percent, 100)}%` }} />
                            </div>
                            <span className="text-xs w-8">{Math.round(percent)}%</span>
                          </div>
                        </td>
                        <td>
                          {budgetHrs === 0 ? (
                            <span className="badge badge-gray">No Budget</span>
                          ) : percent > 100 ? (
                            <span className="badge badge-red">Over Budget</span>
                          ) : percent > 80 ? (
                            <span className="badge badge-yellow">Near Limit</span>
                          ) : (
                            <span className="badge badge-green">On Track</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── UTILISATION TAB ── */}
      {tab === 'utilisation' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-1 font-bold">Staff Utilisation (Avg Weekly)</h3>
            <button className="btn btn-secondary btn-sm" onClick={exportUtilisation}>⬇ Export PDF</button>
          </div>
          
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Department</th>
                    <th>Total Hours</th>
                    <th>Avg Weekly</th>
                    <th>Utilisation %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {utilisationData.map(u => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td className="text-3">{u.department || '—'}</td>
                      <td className="font-mono">{u.totalHours}h</td>
                      <td className="font-bold">{u.avgWeekly}h</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="progress flex-1" style={{ minWidth: 80 }}>
                            <div 
                              className={`progress-bar ${u.isOver ? 'danger' : u.isUnder ? 'warning' : ''}`} 
                              style={{ width: `${Math.min(u.utilization, 100)}%` }} 
                            />
                          </div>
                          <span className="text-xs">{u.utilization}%</span>
                        </div>
                      </td>
                      <td>
                        {u.isOver && <span className="text-danger font-bold">🚩 Over (&gt;{settings?.utilizationThresholds?.high || 40}h)</span>}
                        {u.isUnder && <span className="text-warning font-bold">🚩 Under (&lt;{settings?.utilizationThresholds?.low || 25}h)</span>}
                        {!u.isOver && !u.isUnder && u.totalHours > 0 && <span className="text-success">Optimal</span>}
                        {u.totalHours === 0 && <span className="text-4 italic">No activity</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── STAFF YTD TAB ── */}
      {tab === 'staff_ytd' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <input 
                className="form-input" 
                placeholder="Filter name..." 
                value={staffFilter} 
                onChange={e => setStaffFilter(e.target.value)} 
                style={{ width: 200 }}
              />
              <select 
                className="form-select" 
                value={deptFilter} 
                onChange={e => setDeptFilter(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportYTD}>⬇ Export CSV</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Department</th>
                    <th>YTD Approved Hrs</th>
                    <th>Weeks Active</th>
                    <th>Submission Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {staffYTD
                    .filter(s => {
                      const matchName = s.name.toLowerCase().includes(staffFilter.toLowerCase())
                      const matchDept = !deptFilter || s.department === deptFilter
                      return matchName && matchDept
                    })
                    .map(s => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-3">{s.department || '—'}</td>
                        <td className="font-bold text-accent">{s.ytdHours}h</td>
                        <td>{s.weeksActive}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="progress flex-1" style={{ minWidth: 80 }}>
                              <div 
                                className="progress-bar" 
                                style={{ width: `${s.submitRate}%`, backgroundColor: s.submitRate >= 80 ? 'var(--success)' : 'var(--warning)' }} 
                              />
                            </div>
                            <span className="text-xs">{s.submitRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* ── MONTH COMPARE TAB ── */}
      {tab === 'month_compare' && (
        <div className="flex flex-col gap-6">
          <div className="grid-2">
            <div className="card">
              <h3 className="text-1 font-bold mb-4">Hours: Current vs Previous</h3>
              <div className="flex items-end gap-4 h-40">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="bg-accent w-full rounded-t-lg transition-all" style={{ height: `${(monthCompareData.current.hours / Math.max(monthCompareData.current.hours, monthCompareData.previous.hours, 1)) * 100}%` }} />
                  <span className="text-xs font-bold">{monthCompareData.current.hours}h</span>
                  <span className="text-4 text-xs">{format(dateRange.start, 'MMM yyyy')}</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="bg-border w-full rounded-t-lg transition-all" style={{ height: `${(monthCompareData.previous.hours / Math.max(monthCompareData.current.hours, monthCompareData.previous.hours, 1)) * 100}%` }} />
                  <span className="text-xs font-bold">{monthCompareData.previous.hours}h</span>
                  <span className="text-4 text-xs">Previous</span>
                </div>
              </div>
            </div>

            <div className="card flex flex-col justify-center gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4 text-sm">Hour Variance</div>
                  <div className={`text-2xl font-bold ${monthCompareData.current.hours >= monthCompareData.previous.hours ? 'text-success' : 'text-danger'}`}>
                    {monthCompareData.current.hours >= monthCompareData.previous.hours ? '+' : ''}
                    {parseFloat((monthCompareData.current.hours - monthCompareData.previous.hours).toFixed(1))}h
                  </div>
                </div>
                <div className="text-4xl">
                  {monthCompareData.current.hours >= monthCompareData.previous.hours ? '📈' : '📉'}
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4 text-sm">Submission Variance</div>
                  <div className="text-2xl font-bold text-accent">
                    {monthCompareData.current.submissions >= monthCompareData.previous.submissions ? '+' : ''}
                    {monthCompareData.current.submissions - monthCompareData.previous.submissions}
                  </div>
                </div>
                <div className="text-4xl text-3">📋</div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}

const COL_LABELS = { name: 'Name', department: 'Department', totalHours: 'Total Hours', approvedHours: 'Approved Hours', weeks: 'Weeks Active', submitRate: 'Submit Rate', utilization: 'Utilization', points: 'Points' }
