'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts'
import { getWeekKey, weekRange, exportCSV, exportPDF, fmtDate } from '../../lib/utils'
import { Staff, Entry, Reward, Redemption, HofEntry, AppMessage, Leave } from '../../types'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, subWeeks, eachWeekOfInterval, startOfDay, endOfDay } from 'date-fns'
import * as XLSX from 'xlsx'

const COLORS = ['#076C04', '#22C55E', '#EAB308', '#D8001A', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16']
const TT = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-1)' }

type PeriodType = 'week' | 'month' | 'custom'

export default function AnalyticsPage() {
  const { staff, entries, settings, projects, projectBudgets, bulkImportLogs } = useApp()
  const [tab, setTab] = useState('overview')
  
  // Filter State
  const [periodType, setPeriodType] = useState<PeriodType>('week')
  const [selectedWeek, setSelectedWeek] = useState(getWeekKey())
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [customStart, setCustomStart] = useState(format(subWeeks(new Date(), 4), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [staffFilter, setStaffFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  // Comparison State
  const [compareStaff1, setCompareStaff1] = useState<string>('')
  const [compareStaff2, setCompareStaff2] = useState<string>('')

  // Bulk Import State
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const { saveEntries, saveBulkImportLogs, user } = useApp()
  
  // Utils
  const weekCap = settings?.weekly_cap || 45
  const activeStaff = staff.filter(s => !s.suspended)
  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean).map(d => d as string))).sort()

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

  // Filtered Data
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.deleted) return false
      const d = parseISO(e.date)
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end })
    })
  }, [entries, dateRange])

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
    const decided = filteredEntries.filter(e => ['approved', 'rejected'].includes(e.status))
    const approvalRate = decided.length > 0 ? Math.round((approved.length / decided.length) * 100) : 0
    
    const staffWithEntries = Array.from(new Set(filteredEntries.map(e => e.staffId)))
    const activeStaffCount = staffWithEntries.length
    const notSubmittedList = activeStaff.filter(s => !staffWithEntries.includes(s.id))

    return {
      totalHours: parseFloat(totalHours.toFixed(1)),
      approvalRate,
      pendingCount: pending.length,
      activeStaffCount,
      notSubmittedList
    }
  }, [filteredEntries, activeStaff])

  // Bar chart - hours logged across last 5 weeks
  const last5WeeksData = useMemo(() => {
    const weeks: any[] = []
    const end = dateRange.end
    const start = subWeeks(end, 4)
    const interval = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
    
    interval.forEach(w => {
      const wKey = getWeekKey(w)
      const wEntries = entries.filter(e => e.weekKey === wKey && e.status === 'approved' && !e.deleted)
      weeks.push({
        week: format(w, 'dd MMM'),
        hours: parseFloat(wEntries.reduce((s, e) => s + (e.hours || 0), 0).toFixed(1))
      })
    })
    return weeks.slice(-5)
  }, [entries, dateRange])

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
      const ents = entries.filter(e => !e.deleted && isWithinInterval(parseISO(e.date), { start, end }))
      const approved = ents.filter(e => e.status === 'approved')
      const hours = approved.reduce((sum, e) => sum + (e.hours || 0), 0)
      const submissionCount = new Set(ents.map(e => `${e.staffId}-${e.weekKey}`)).size
      return { hours: parseFloat(hours.toFixed(1)), submissions: submissionCount }
    }

    const current = getMonthStats(currentMonthStart, endOfMonth(currentMonthStart))
    const previous = getMonthStats(prevMonthStart, prevMonthEnd)

    return { current, previous }
  }, [entries, dateRange.start])

  // Utilisation Data
  const utilisationData = useMemo(() => {
    // Determine number of weeks in period for averaging
    const days = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    const weeksInPeriod = Math.max(days / 7, 1)

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
        isUnder: avgWeekly < 30 && totalHours > 0,
        isOver: avgWeekly > weekCap
      }
    }).sort((a, b) => b.avgWeekly - a.avgWeekly)
  }, [filteredStaff, filteredEntries, weekCap, dateRange])

  // Staff YTD Data
  const staffYTD = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const yearEnd = new Date()
    const ytdEntries = entries.filter(e => !e.deleted && parseISO(e.date) >= yearStart)
    
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
  }, [activeStaff, entries])

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json(ws) as any[]
      
      const errors: string[] = []
      const preview = data.map((row, idx) => {
        const staffObj = staff.find(s => s.id === row.staffId || s.email === row.email)
        const projObj = projects.find(p => p.name === row.project)
        
        if (!staffObj) errors.push(`Row ${idx + 2}: Staff not found (${row.staffId || row.email})`)
        if (!projObj) errors.push(`Row ${idx + 2}: Project not found (${row.project})`)
        if (!row.date || isNaN(Date.parse(row.date))) errors.push(`Row ${idx + 2}: Invalid date (${row.date})`)
        if (isNaN(parseFloat(row.hours))) errors.push(`Row ${idx + 2}: Invalid hours (${row.hours})`)

        return {
          ...row,
          isValid: !errors.length,
          staffName: staffObj?.name || 'Unknown',
          projectName: projObj?.name || 'Unknown'
        }
      })

      setImportPreview(preview)
      setImportErrors(errors)
    }
    reader.readAsBinaryString(file)
  }

  const commitImport = async () => {
    if (importErrors.length > 0) {
      toast.error('Please fix errors before importing')
      return
    }
    if (importPreview.length === 0) return

    setImporting(true)
    try {
      const newEntries: Entry[] = importPreview.map(row => {
        const s = staff.find(st => st.id === row.staffId || st.email === row.email)
        const entryDate = format(new Date(row.date), 'yyyy-MM-dd')
        return {
          id: Math.random().toString(36).substr(2, 9),
          staffId: s?.id || row.staffId,
          staffName: s?.name || 'Unknown',
          date: entryDate,
          startDate: entryDate,
          endDate: entryDate,
          hours: parseFloat(row.hours),
          project: row.project,
          category: row.category || 'Client Work',
          description: row.description || 'Bulk imported',
          status: 'approved' as const,
          weekKey: getWeekKey(new Date(row.date)),
          createdAt: new Date().toISOString(),
          createdBy: user?.id || 'system'
        }
      })

      await saveEntries([...entries, ...newEntries])
      
      const log = {
        id: Math.random().toString(36).substr(2, 9),
        importedBy: user?.id || 'admin',
        importedByName: user?.name || 'Admin',
        timestamp: new Date().toISOString(),
        totalRows: importPreview.length,
        successCount: importPreview.length,
        failCount: 0,
        errors: []
      }
      await saveBulkImportLogs([...bulkImportLogs, log])
      
      toast.success(`Successfully imported ${newEntries.length} entries`)
      setImportPreview([])
      setTab('overview')
    } catch (e) {
      toast.error('Import failed')
      console.error(e)
    } finally {
      setImporting(false)
    }
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
        {['overview', 'projects', 'utilisation', 'staff_ytd', 'compare_staff', 'month_compare', 'bulk_import'].map(t => (
          <div
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-label">Total Hours</div>
              <div className="stat-value text-accent">{stats.totalHours}h</div>
              <div className="stat-sub">Approved entries in period</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Approval Rate</div>
              <div className="stat-value" style={{ color: stats.approvalRate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                {stats.approvalRate}%
              </div>
              <div className="stat-sub">Of submitted entries</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Count</div>
              <div className="stat-value text-warning">{stats.pendingCount}</div>
              <div className="stat-sub">Awaiting review</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Staff</div>
              <div className="stat-value">{stats.activeStaffCount}</div>
              <div className="stat-sub">Logging hours in period</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 className="text-1 font-bold mb-4">Hours Logged (Last 5 Weeks)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={last5WeeksData}>
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Approved Hours" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-1 font-bold">Not-Submitted List</h3>
                <button className="btn btn-secondary btn-sm" onClick={exportNotSubmitted}>⬇ Export CSV</button>
              </div>
              <div className="table-wrap flex-1" style={{ maxHeight: 250 }}>
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
      )}

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
                        {u.isOver && <span className="text-danger font-bold">🚩 Over (&gt;{weekCap}h)</span>}
                        {u.isUnder && <span className="text-warning font-bold">🚩 Under (&lt;30h)</span>}
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

      {/* ── COMPARE STAFF TAB ── */}
      {tab === 'compare_staff' && (
        <div className="flex flex-col gap-6">
          <div className="card flex items-center gap-4">
            <div className="flex-1">
              <label className="form-label text-xs">Staff 1</label>
              <select className="form-select" value={compareStaff1} onChange={e => setCompareStaff1(e.target.value)}>
                <option value="">Select staff...</option>
                {activeStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="text-4 font-bold">VS</div>
            <div className="flex-1">
              <label className="form-label text-xs">Staff 2</label>
              <select className="form-select" value={compareStaff2} onChange={e => setCompareStaff2(e.target.value)}>
                <option value="">Select staff...</option>
                {activeStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {compareStaff1 && compareStaff2 ? (
            <div className="grid-2">
              {[compareStaff1, compareStaff2].map((sid, idx) => {
                const s = staff.find(st => st.id === sid)
                const sEntries = filteredEntries.filter(e => e.staffId === sid && e.status === 'approved')
                const hours = sEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
                return (
                  <div key={sid} className="card flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold">
                        {s?.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-1">{s?.name}</h3>
                        <p className="text-xs text-3">{s?.department || 'No Dept'}</p>
                      </div>
                    </div>
                    <div className="grid-2 gap-3">
                      <div className="bg-elevated p-3 rounded-lg text-center">
                        <div className="text-4 text-xs mb-1">Total Hours</div>
                        <div className="text-1 font-bold text-xl">{hours}h</div>
                      </div>
                      <div className="bg-elevated p-3 rounded-lg text-center">
                        <div className="text-4 text-xs mb-1">Avg Weekly</div>
                        <div className="text-1 font-bold text-xl">
                          {parseFloat((hours / (utilisationData.length > 0 ? 4 : 1)).toFixed(1))}h
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card py-20 text-center opacity-50">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-1 font-bold">Select two staff members to compare</h3>
            </div>
          )}
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

      {/* ── BULK IMPORT TAB ── */}
      {tab === 'bulk_import' && (
        <div className="flex flex-col gap-6">
          <div className="card">
            <h3 className="text-1 font-bold mb-2">Import Entries from CSV</h3>
            <p className="text-3 text-sm mb-6">
              Upload a CSV file with columns: <code className="bg-elevated px-1 rounded">staffId</code> (or email), 
              <code className="bg-elevated px-1 rounded">project</code>, 
              <code className="bg-elevated px-1 rounded">date</code> (YYYY-MM-DD), 
              <code className="bg-elevated px-1 rounded">hours</code>, 
              <code className="bg-elevated px-1 rounded">category</code>, and 
              <code className="bg-elevated px-1 rounded">description</code>.
            </p>
            
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept=".csv,.xlsx" 
                onChange={handleFileUpload} 
                className="form-input" 
                style={{ width: 'auto' }}
              />
              {importPreview.length > 0 && (
                <button 
                  className={`btn btn-primary ${importing || importErrors.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={commitImport}
                  disabled={importing || importErrors.length > 0}
                >
                  {importing ? 'Importing...' : `Import ${importPreview.length} Entries`}
                </button>
              )}
            </div>
          </div>

          {importErrors.length > 0 && (
            <div className="card bg-danger-light border-danger text-danger">
              <h4 className="font-bold mb-2">Validation Errors:</h4>
              <ul className="list-disc pl-5 text-sm">
                {importErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {importPreview.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Project</th>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i}>
                        <td className="font-medium">{row.staffName} <span className="text-4 text-xs">({row.staffId || row.email})</span></td>
                        <td>{row.projectName}</td>
                        <td className="font-mono">{row.date}</td>
                        <td className="font-bold">{row.hours}h</td>
                        <td className="text-3 text-xs truncate max-w-xs">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-1 font-bold mb-4">Recent Import Logs</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Imported By</th>
                    <th>Rows</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkImportLogs.slice().reverse().map(log => (
                    <tr key={log.id}>
                      <td className="text-4 text-sm">{fmtDate(log.timestamp)}</td>
                      <td>{log.importedByName}</td>
                      <td>{log.totalRows}</td>
                      <td>{log.failCount > 0 ? <span className="text-danger font-bold">{log.failCount}</span> : 'None'}</td>
                    </tr>
                  ))}
                  {bulkImportLogs.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-4">No import history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const COL_LABELS = { name: 'Name', department: 'Department', totalHours: 'Total Hours', approvedHours: 'Approved Hours', weeks: 'Weeks Active', submitRate: 'Submit Rate', utilization: 'Utilization', points: 'Points' }
