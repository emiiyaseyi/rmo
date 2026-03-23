import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts'
import { getWeekKey, weekRange, exportCSV, exportPDF, fmtDate } from '../../lib/utils'
import toast from 'react-hot-toast'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#84CC16']
const TT = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }

export default function AnalyticsPage() {
  const { staff, entries, settings, projects, budgets, saveBudgets } = useApp()
  const [tab, setTab] = useState('overview')
  const [staffFilter, setStaffFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [compareWeeks, setCompareWeeks] = useState([])
  const [reportColumns, setReportColumns] = useState({ name:true, department:true, totalHours:true, approvedHours:true, weeks:true, submitRate:true, utilization:true, points:true })
  const [showColPicker, setShowColPicker] = useState(false)
  const [budgetProject, setBudgetProject] = useState('')
  const [budgetHours, setBudgetHours] = useState('')

  const weekCap = settings?.weekly_cap || 45
  const currentWeek = getWeekKey()
  const activeStaff = staff.filter(s => !s.suspended)
  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))].sort()

  const last8Weeks = useMemo(() => {
    const result = []
    for (let i = 7; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i*7)
      result.push(getWeekKey(d))
    }
    return result
  }, [])

  // Current week stats
  const currentEntries = entries.filter(e => e.weekKey === currentWeek && !e.deleted)
  const submittedStaffIds = [...new Set(currentEntries.filter(e => ['submitted','approved','resubmitted'].includes(e.status)).map(e => e.staffId))]
  const submissionRate = activeStaff.length > 0 ? Math.round((submittedStaffIds.length/activeStaff.length)*100) : 0
  const totalApproved = entries.filter(e => e.status==='approved' && !e.deleted).reduce((s,e) => s+(e.hours||0), 0)
  const pendingCount = entries.filter(e => ['submitted','resubmitted'].includes(e.status) && !e.deleted).length
  const rejectedCount = entries.filter(e => e.status==='rejected' && !e.deleted).length
  const approvalRate = (() => {
    const decided = entries.filter(e => ['approved','rejected'].includes(e.status) && !e.deleted).length
    const approved = entries.filter(e => e.status==='approved' && !e.deleted).length
    return decided > 0 ? Math.round((approved/decided)*100) : 0
  })()

  // Hours by week chart
  const hoursByWeek = useMemo(() => last8Weeks.map(w => {
    const wEntries = entries.filter(e => e.weekKey===w && e.status==='approved' && !e.deleted)
    const submitted = [...new Set(entries.filter(e => e.weekKey===w && ['submitted','approved','resubmitted'].includes(e.status) && !e.deleted).map(e => e.staffId))]
    return {
      week: weekRange(w).split('–')[0].trim(),
      weekKey: w,
      hours: parseFloat(wEntries.reduce((s,e) => s+(e.hours||0),0).toFixed(1)),
      entries: wEntries.length,
      submittedStaff: submitted.length,
    }
  }), [entries, last8Weeks])

  // Compare weeks
  const compareData = useMemo(() => {
    if (compareWeeks.length < 2) return []
    return compareWeeks.map(w => ({
      week: weekRange(w).split('–')[0].trim(),
      hours: parseFloat(entries.filter(e => e.weekKey===w && e.status==='approved' && !e.deleted).reduce((s,e) => s+(e.hours||0),0).toFixed(1)),
      submissions: [...new Set(entries.filter(e => e.weekKey===w && ['submitted','approved','resubmitted'].includes(e.status) && !e.deleted).map(e => e.staffId))].length,
      approved: entries.filter(e => e.weekKey===w && e.status==='approved' && !e.deleted).length,
      rejected: entries.filter(e => e.weekKey===w && e.status==='rejected' && !e.deleted).length,
    }))
  }, [entries, compareWeeks])

  // Project hours with budget
  const projectData = useMemo(() => {
    const map = {}
    entries.filter(e => e.status==='approved' && !e.deleted).forEach(e => {
      if (!map[e.project]) map[e.project] = 0
      map[e.project] += e.hours||0
    })
    return Object.entries(map).map(([name, actual]) => {
      const proj = projects.find(p => p.name === name)
      const budget = budgets.find(b => b.project === name)?.hours || proj?.budget || 0
      return { name, actual: parseFloat(actual.toFixed(1)), budget: parseFloat(budget), variance: budget > 0 ? parseFloat((actual - budget).toFixed(1)) : null }
    }).sort((a,b) => b.actual - a.actual).slice(0, 10)
  }, [entries, projects, budgets])

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = {}
    entries.filter(e => e.status==='approved' && !e.deleted).forEach(e => {
      if (!map[e.category||'Uncategorised']) map[e.category||'Uncategorised'] = 0
      map[e.category||'Uncategorised'] += e.hours||0
    })
    return Object.entries(map).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }))
  }, [entries])

  // Staff YTD
  const staffYTD = useMemo(() => activeStaff
    .filter(s => !deptFilter || s.department === deptFilter)
    .filter(s => !staffFilter || s.name.toLowerCase().includes(staffFilter.toLowerCase()))
    .map(s => {
      const my = entries.filter(e => e.staffId===s.id && !e.deleted)
      const weeks = [...new Set(my.map(e => e.weekKey))]
      const submitted = weeks.filter(w => my.some(e => e.weekKey===w && ['submitted','approved','resubmitted'].includes(e.status)))
      const totalH = parseFloat(my.reduce((a,e) => a+(e.hours||0),0).toFixed(1))
      const approvedH = parseFloat(my.filter(e => e.status==='approved').reduce((a,e) => a+(e.hours||0),0).toFixed(1))
      const util = weeks.length > 0 && weekCap > 0 ? Math.round((totalH/(weekCap*weeks.length))*100) : 0
      return { id:s.id, name:s.name, department:s.department||'—', totalHours:totalH, approvedHours:approvedH, weeks:weeks.length, submittedWeeks:submitted.length, submitRate: weeks.length > 0 ? Math.round((submitted.length/weeks.length)*100) : 0, utilization:util, points:s.points||0, streak:s.streak||0 }
    }), [activeStaff, entries, deptFilter, staffFilter, weekCap])

  const notSubmitted = activeStaff.filter(s => !submittedStaffIds.includes(s.id))

  function exportYTD() {
    const cols = Object.entries(reportColumns).filter(([,v]) => v).map(([k]) => k)
    const colMap = { name:'Name', department:'Department', totalHours:'Total Hours', approvedHours:'Approved Hours', weeks:'Weeks', submitRate:'Submit Rate %', utilization:'Utilization %', points:'Points' }
    const rows = staffYTD.map(s => {
      const row = {}
      cols.forEach(c => { row[colMap[c]||c] = s[c] })
      return row
    })
    exportCSV(rows, 'dsn_staff_ytd.csv')
    toast.success('YTD report exported')
  }

  async function exportYTDpdf() {
    const cols = Object.entries(reportColumns).filter(([,v]) => v).map(([k]) => k)
    const colMap = { name:'Name', department:'Department', totalHours:'Total Hrs', approvedHours:'Approved Hrs', weeks:'Weeks', submitRate:'Submit %', utilization:'Util %', points:'Points' }
    try {
      await exportPDF(staffYTD, cols.map(k => ({ key:k, label:colMap[k]||k })), 'DSN Staff YTD Report', 'dsn_staff_ytd.pdf')
      toast.success('PDF exported')
    } catch { toast.error('PDF failed — use CSV') }
  }

  function saveBudget() {
    if (!budgetProject || !budgetHours) { toast.error('Select project and enter hours'); return }
    const updated = budgets.filter(b => b.project !== budgetProject)
    updated.push({ project: budgetProject, hours: parseFloat(budgetHours) })
    saveBudgets(updated)
    setBudgetProject(''); setBudgetHours('')
    toast.success('Budget saved')
  }

  function toggleCompareWeek(w) {
    setCompareWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : prev.length < 5 ? [...prev, w] : prev)
  }

  const COL_LABELS = { name:'Name', department:'Department', totalHours:'Total Hours', approvedHours:'Approved Hours', weeks:'Weeks Active', submitRate:'Submit Rate', utilization:'Utilization', points:'Points' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800 }}>📊 Analytics</h1>
          <p style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>Team performance, insights & reports</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-4">
        {[
          { label:'Submission Rate', value:submissionRate+'%', sub:submittedStaffIds.length+'/'+activeStaff.length+' staff', color: submissionRate>=80?'var(--success)':'var(--warning)' },
          { label:'Approval Rate', value:approvalRate+'%', sub:'of decided entries', color: approvalRate>=80?'var(--success)':'var(--warning)' },
          { label:'Pending Approval', value:pendingCount, sub:'entries awaiting review', color:'var(--warning)' },
          { label:'Total Approved Hrs', value:totalApproved+'h', sub:'all time', color:'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview','compare','projects','staff_ytd','not_submitted'].map(t => (
          <div key={t} className={'tab'+(tab===t?' active':'')} onClick={() => setTab(t)}>
            {t==='overview'?'Overview':t==='compare'?'Week Compare':t==='projects'?'Projects':t==='staff_ytd'?'Staff YTD':'Not Submitted'}
          </div>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='overview' && (
        <>
          <div className="chart-wrap">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Approved Hours — Last 8 Weeks</h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={hoursByWeek}>
                <XAxis dataKey="week" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                <YAxis yAxisId="left" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                <Tooltip contentStyle={TT} />
                <Bar yAxisId="left" dataKey="hours" fill="var(--accent)" radius={[4,4,0,0]} name="Hours" />
                <Line yAxisId="right" type="monotone" dataKey="submittedStaff" stroke="var(--success)" strokeWidth={2} dot={{ r:3 }} name="Staff Submitted" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid-2">
            <div className="chart-wrap">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Hours by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => percent>0.05 ? name.slice(0,10)+' '+Math.round(percent*100)+'%' : ''} labelLine={false}>
                    {categoryData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-wrap">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Weekly Breakdown</h3>
              <table style={{ width:'100%' }}>
                <thead><tr><th style={{ textAlign:'left', fontSize:11, color:'var(--text-3)', padding:'4px 0' }}>Week</th><th style={{ textAlign:'right', fontSize:11, color:'var(--text-3)' }}>Hours</th><th style={{ textAlign:'right', fontSize:11, color:'var(--text-3)' }}>Entries</th><th style={{ textAlign:'right', fontSize:11, color:'var(--text-3)' }}>Staff</th></tr></thead>
                <tbody>
                  {hoursByWeek.slice(-5).map((w,i) => (
                    <tr key={i}>
                      <td style={{ fontSize:12, padding:'6px 0', color:'var(--text-2)' }}>{w.week}</td>
                      <td style={{ textAlign:'right', fontWeight:700, fontFamily:'var(--mono)', fontSize:12 }}>{w.hours}h</td>
                      <td style={{ textAlign:'right', color:'var(--text-3)', fontSize:12 }}>{w.entries}</td>
                      <td style={{ textAlign:'right', color:'var(--text-3)', fontSize:12 }}>{w.submittedStaff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── WEEK COMPARE ── */}
      {tab==='compare' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Select up to 5 weeks to compare:</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {last8Weeks.map(w => (
                <button key={w} className={'chip'+(compareWeeks.includes(w)?' active':'')} onClick={() => toggleCompareWeek(w)}>
                  {weekRange(w).split('–')[0].trim()}
                </button>
              ))}
            </div>
          </div>
          {compareWeeks.length >= 2 ? (
            <>
              <div className="chart-wrap">
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Side-by-Side Week Comparison</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={compareData}>
                    <XAxis dataKey="week" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text-3)' }} />
                    <Tooltip contentStyle={TT} />
                    <Bar dataKey="hours" fill="var(--accent)" radius={[4,4,0,0]} name="Approved Hours" />
                    <Bar dataKey="submissions" fill="var(--success)" radius={[4,4,0,0]} name="Staff Submitted" />
                    <Bar dataKey="rejected" fill="var(--danger)" radius={[4,4,0,0]} name="Rejected Entries" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Week</th><th>Approved Hours</th><th>Staff Submitted</th><th>Approved Entries</th><th>Rejected Entries</th></tr></thead>
                    <tbody>
                      {compareData.map((w,i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{w.week}</td>
                          <td style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{w.hours}h</td>
                          <td>{w.submissions}</td>
                          <td style={{ color:'var(--success)' }}>{w.approved}</td>
                          <td style={{ color:'var(--danger)' }}>{w.rejected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state card">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Select at least 2 weeks</div>
            </div>
          )}
        </div>
      )}

      {/* ── PROJECTS + BUDGET ── */}
      {tab==='projects' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Budget setter */}
          <div className="card">
            <div style={{ fontWeight:700, marginBottom:12 }}>Set Project Budgets (hours)</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div className="form-group" style={{ flex:1, minWidth:200 }}>
                <label className="form-label">Project</label>
                <select className="form-select" value={budgetProject} onChange={e => setBudgetProject(e.target.value)}>
                  <option value="">Select project…</option>
                  {projects.filter(p => p.active).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ width:140 }}>
                <label className="form-label">Budget (hours)</label>
                <input className="form-input" type="number" value={budgetHours} onChange={e => setBudgetHours(e.target.value)} placeholder="e.g. 200" />
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveBudget} style={{ marginBottom:0 }}>Set Budget</button>
            </div>
          </div>

          {/* Budget vs Actual chart */}
          <div className="chart-wrap">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Budget vs Actual Hours (Top 10 Projects)</h3>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={projectData} layout="vertical">
                <XAxis type="number" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize:11, fill:'var(--text-2)' }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="actual" fill="var(--accent)" radius={[0,4,4,0]} name="Actual Hours" />
                <Bar dataKey="budget" fill="var(--border-light)" radius={[0,4,4,0]} name="Budget Hours" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget table */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Project</th><th>Actual Hours</th><th>Budget</th><th>Variance</th><th>Status</th></tr></thead>
                <tbody>
                  {projectData.map((p,i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:600 }}>{p.name}</td>
                      <td style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{p.actual}h</td>
                      <td style={{ fontFamily:'var(--mono)', color:'var(--text-3)' }}>{p.budget > 0 ? p.budget+'h' : '—'}</td>
                      <td style={{ fontFamily:'var(--mono)', color: p.variance === null ? 'var(--text-3)' : p.variance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: p.variance !== null ? 700 : 400 }}>
                        {p.variance === null ? '—' : (p.variance > 0 ? '+' : '') + p.variance + 'h'}
                      </td>
                      <td>
                        {p.budget > 0
                          ? p.actual > p.budget
                            ? <span className="badge badge-red">Over Budget</span>
                            : p.actual > p.budget * 0.8
                              ? <span className="badge badge-yellow">Near Limit</span>
                              : <span className="badge badge-green">On Track</span>
                          : <span className="badge badge-gray">No Budget</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── STAFF YTD ── */}
      {tab==='staff_ytd' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <input className="form-input" style={{ maxWidth:220 }} placeholder="Search staff…" value={staffFilter} onChange={e => setStaffFilter(e.target.value)} />
              <select className="form-select" style={{ width:'auto' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8, position:'relative' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowColPicker(!showColPicker)}>⚙ Columns</button>
              <button className="btn btn-secondary btn-sm" onClick={exportYTD}>⬇ CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={exportYTDpdf}>PDF</button>
              {showColPicker && (
                <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:14, zIndex:50, minWidth:200, boxShadow:'var(--shadow)' }}>
                  <div style={{ fontWeight:700, fontSize:12, marginBottom:10 }}>Select Columns</div>
                  {Object.entries(COL_LABELS).map(([k,label]) => (
                    <label key={k} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer', fontSize:13 }}>
                      <input type="checkbox" checked={reportColumns[k]} onChange={() => setReportColumns(c => ({ ...c, [k]: !c[k] }))} />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {reportColumns.name && <th>Name</th>}
                    {reportColumns.department && <th>Department</th>}
                    {reportColumns.totalHours && <th>Total Hrs</th>}
                    {reportColumns.approvedHours && <th>Approved Hrs</th>}
                    {reportColumns.weeks && <th>Weeks</th>}
                    {reportColumns.submitRate && <th>Submit Rate</th>}
                    {reportColumns.utilization && <th>Utilization</th>}
                    {reportColumns.points && <th>Points</th>}
                  </tr>
                </thead>
                <tbody>
                  {staffYTD.map(s => (
                    <tr key={s.id}>
                      {reportColumns.name && <td style={{ fontWeight:600 }}>{s.name}</td>}
                      {reportColumns.department && <td style={{ color:'var(--text-3)' }}>{s.department}</td>}
                      {reportColumns.totalHours && <td style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{s.totalHours}h</td>}
                      {reportColumns.approvedHours && <td style={{ fontFamily:'var(--mono)', color:'var(--success)' }}>{s.approvedHours}h</td>}
                      {reportColumns.weeks && <td>{s.weeks}</td>}
                      {reportColumns.submitRate && (
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div className="progress" style={{ width:48 }}>
                              <div className="progress-bar" style={{ width:s.submitRate+'%', background:s.submitRate>=80?'var(--success)':'var(--warning)' }} />
                            </div>
                            <span style={{ fontSize:12 }}>{s.submitRate}%</span>
                          </div>
                        </td>
                      )}
                      {reportColumns.utilization && (
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div className="progress" style={{ width:48 }}>
                              <div className="progress-bar" style={{ width:Math.min(s.utilization,100)+'%' }} />
                            </div>
                            <span style={{ fontSize:12 }}>{s.utilization}%</span>
                          </div>
                        </td>
                      )}
                      {reportColumns.points && <td style={{ color:'var(--gold)', fontWeight:700 }}>{s.points}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── NOT SUBMITTED ── */}
      {tab==='not_submitted' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div style={{ fontSize:14, fontWeight:600 }}>
              {notSubmitted.length} staff haven't submitted — {weekRange(currentWeek)}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { exportCSV(notSubmitted.map(s => ({ Name:s.name, Email:s.email, Department:s.department, Lead:s.leadName||'' })), 'not_submitted_'+currentWeek+'.csv'); toast.success('Exported') }}>
              ⬇ Export List
            </button>
          </div>
          {notSubmitted.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-title">All staff have submitted!</div>
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Lead</th><th>Last Login</th></tr></thead>
                  <tbody>
                    {notSubmitted.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight:600 }}>{s.name}</td>
                        <td style={{ color:'var(--text-3)', fontSize:12 }}>{s.email}</td>
                        <td>{s.department || '—'}</td>
                        <td>{s.leadName || '—'}</td>
                        <td style={{ fontSize:12, color:'var(--text-3)' }}>{s.last_login ? new Date(s.last_login).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const COL_LABELS = { name:'Name', department:'Department', totalHours:'Total Hours', approvedHours:'Approved Hours', weeks:'Weeks Active', submitRate:'Submit Rate', utilization:'Utilization', points:'Points' }
