'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { exportCSV, genId } from '../../lib/utils'
import { AppSettings, WeekLock, PublicHoliday } from '../../types'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const {
    settings, saveSettings, user, logAudit,
    weekLocks, saveWeekLocks,
    auditLogs,
    publicHolidays, savePublicHolidays,
    staff,
    entries,
    leaves,
    nots,
    rewards,
    redeems,
    announcements,
    projects
  } = useApp()

  const [tab, setTab] = useState<string>('branding')
  const [testingConnection, setTestingConnection] = useState(false)
  
  // Local form state
  const [fbForm, setFbForm] = useState(settings?.firebase || { url: '', anonKey: '', isConnected: false })
  const [brandForm, setBrandForm] = useState(settings?.branding || { appName: 'DSN Timesheet', welcomeMessage: 'Welcome', primaryColour: '#4F46E5', secondaryColour: '#10B981', logoBase64: null })
  const [pointsForm, setPointsForm] = useState(settings?.pointsConfig || { onTimeSubmission: 10, mondayBonus: 5, earlyBonus: 5, approvedEntry: 10, approvedWithNote: 5, perfectWeek: 20, hoursBonus: 1, streakBonus: 15, rejectionDeduction: -5 })
  const [capsForm, setCapsForm] = useState(settings?.hourCaps || { defaultStaffCap: 40, internCap: 32, cdsVisibility: true, customCaps: [] })
  const [securityForm, setSecurityForm] = useState(settings?.security || { defaultPassword: 'dsn-staff', requireTwoFactor: false })
  const [submissionWindowForm, setSubmissionWindowForm] = useState(settings?.submissionWindow || {
    enabled: true,
    schedule: { startDay: 'monday' as const, startTime: '08:00', endDay: 'tuesday' as const, endTime: '16:00' },
    latePenalty: { enabled: true, pointsPerPeriod: -5, periodHours: 12 },
    timezone: 'Africa/Windhoek'
  })
  const [auditSearch, setAuditSearch] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')

  const tabs = [
    { id: 'branding', label: 'Branding' },
    { id: 'points', label: 'Points' },
    { id: 'caps', label: 'Caps' },
    { id: 'submission', label: 'Submission Window' },
    { id: 'weeks', label: 'Weeks' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'security', label: 'Security' },
    { id: 'activity', label: 'Activity Log' },
    { id: 'database', label: 'Database' },
  ]
  const actionOptions = useMemo(
    () => Array.from(new Set((auditLogs || []).map(l => String(l.action || '')).filter(Boolean))).sort(),
    [auditLogs]
  )
  const filteredAuditLogs = useMemo(() => {
    return (auditLogs || []).filter(log => {
      const t = (log.timestamp || '').slice(0, 10)
      const q = auditSearch.trim().toLowerCase()
      const text = `${log.performedBy || ''} ${log.action || ''} ${log.targetId || ''} ${JSON.stringify(log.metadata || {})}`.toLowerCase()
      if (q && !text.includes(q)) return false
      if (auditAction && log.action !== auditAction) return false
      if (auditFrom && t < auditFrom) return false
      if (auditTo && t > auditTo) return false
      return true
    })
  }, [auditLogs, auditSearch, auditAction, auditFrom, auditTo])

  useEffect(() => {
    if (settings?.submissionWindow) {
      setSubmissionWindowForm(settings.submissionWindow)
    }
  }, [settings?.submissionWindow])

  const saveAllSettings = (updates: Partial<AppSettings>) => {
    const newData = { ...settings, ...updates } as AppSettings
    saveSettings(newData)
    logAudit('settings_change', 'system', { updates: Object.keys(updates) })
    toast.success('Settings updated')
  }

  async function testFirebase() {
    setTestingConnection(true)
    // Simulate connection test
    setTimeout(() => {
      const success = fbForm.url.includes('firebase')
      if (success) {
        const update = { ...fbForm, isConnected: true, lastTestedAt: new Date().toISOString() }
        setFbForm(update)
        saveAllSettings({ firebase: update })
        toast.success('Firebase connected!')
      } else {
        toast.error('Connection failed. Check URL.')
      }
      setTestingConnection(false)
    }, 1500)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setBrandForm({ ...brandForm, logoBase64: base64, logoUploadedAt: new Date().toISOString() })
    }
    reader.readAsDataURL(file)
  }

  const scheduleDays = [
    { short: 'Sun', value: 'sunday' },
    { short: 'Mon', value: 'monday' },
    { short: 'Tue', value: 'tuesday' },
    { short: 'Wed', value: 'wednesday' },
    { short: 'Thu', value: 'thursday' },
    { short: 'Fri', value: 'friday' },
    { short: 'Sat', value: 'saturday' },
  ] as const
  const commonTimes = ['08:00', '09:00', '12:00', '16:00', '18:00'] as const
  const titleCaseDay = (day: string) => day.charAt(0).toUpperCase() + day.slice(1)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">⚙️ System Settings</h1>
        <p className="text-sm text-4">Platform configuration and administrative control</p>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <div
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="grid gap-6">


        {/* BRANDING */}
        {tab === 'branding' && (
          <div className="card flex flex-col gap-6">
            <h3 className="font-bold">🎨 App Branding</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">App Name</label>
                <input 
                  className="form-input" 
                  value={brandForm.appName}
                  onChange={e => setBrandForm({...brandForm, appName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Welcome Message</label>
                <input 
                  className="form-input" 
                  value={brandForm.welcomeMessage}
                  onChange={e => setBrandForm({...brandForm, welcomeMessage: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Primary Colour</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    className="w-10 h-10 rounded border-0 p-0 cursor-pointer"
                    value={brandForm.primaryColour}
                    onChange={e => setBrandForm({...brandForm, primaryColour: e.target.value})}
                  />
                  <input 
                    className="form-input flex-1 uppercase"
                    value={brandForm.primaryColour}
                    onChange={e => setBrandForm({...brandForm, primaryColour: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Secondary Colour</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    className="w-10 h-10 rounded border-0 p-0 cursor-pointer"
                    value={brandForm.secondaryColour}
                    onChange={e => setBrandForm({...brandForm, secondaryColour: e.target.value})}
                  />
                  <input 
                    className="form-input flex-1 uppercase"
                    value={brandForm.secondaryColour}
                    onChange={e => setBrandForm({...brandForm, secondaryColour: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Logo</label>
              <div className="flex items-center gap-4 border border-dashed border-3 p-6 rounded-xl bg-2">
                {brandForm.logoBase64 ? (
                  <img src={brandForm.logoBase64} alt="App Logo" className="max-h-16 max-w-[120px] object-contain rounded bg-white p-2 border border-3" />
                ) : (
                  <div className="w-16 h-16 rounded bg-3 flex items-center justify-center text-xl">🖼️</div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="btn btn-secondary text-xs cursor-pointer inline-block w-fit">
                    Upload New Logo
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                  </label>
                  <p className="text-[10px] text-3">Max 1MB. PNG, SVG or WEBP recommended.</p>
                </div>
                {brandForm.logoBase64 && (
                  <button 
                    className="btn btn-icon text-danger ml-auto" 
                    onClick={() => setBrandForm({...brandForm, logoBase64: null})}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>

            <button className="btn btn-primary w-fit" onClick={() => saveAllSettings({ branding: brandForm })}>
              Save Branding Changes
            </button>
          </div>
        )}

        {/* POINTS CONFIG */}
        {tab === 'points' && (
          <div className="card flex flex-col gap-6">
            <h3 className="font-bold">🎯 Points & Awards Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(pointsForm).map(([key, val]) => (
                <div key={key} className="form-group">
                  <label className="form-label capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                  <input 
                    type="number"
                    className="form-input" 
                    value={val}
                    onChange={e => setPointsForm({...pointsForm, [key]: Number(e.target.value)})}
                  />
                </div>
              ))}
            </div>
            <button className="btn btn-primary w-fit" onClick={() => saveAllSettings({ pointsConfig: pointsForm })}>
              Save Points Configuration
            </button>
          </div>
        )}

        {/* HOUR CAPS */}
        {tab === 'caps' && (
          <div className="card flex flex-col gap-6">
            <h3 className="font-bold">🕒 Hour Caps & Visibility</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Default Staff Cap (hrs)</label>
                <input 
                  type="number"
                  className="form-input" 
                  value={capsForm.defaultStaffCap}
                  onChange={e => setCapsForm({...capsForm, defaultStaffCap: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Intern Cap (hrs)</label>
                <input 
                  type="number"
                  className="form-input" 
                  value={capsForm.internCap}
                  onChange={e => setCapsForm({...capsForm, internCap: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-2 rounded-lg border border-3">
              <button
                onClick={() => setCapsForm({...capsForm, cdsVisibility: !capsForm.cdsVisibility})}
                className={`w-10 h-5 rounded-full relative transition-all ${capsForm.cdsVisibility ? 'bg-success' : 'bg-3'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${capsForm.cdsVisibility ? 'left-6' : 'left-1'}`}></div>
              </button>
              <div>
                <div className="text-xs font-bold">CDS Day Visibility</div>
                <div className="text-[10px] text-3">Show CDS Day selection in staff profiles.</div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 p-4 bg-soft-warning rounded-lg border border-warning-subtle">
              <div className="flex items-center gap-2">
                <span className="text-sm">🗓️</span>
                <div className="text-xs font-bold text-warning">Emergency Deadline Extension</div>
              </div>
              <p className="text-[10px] text-warning-subtle">Sets a custom date/time until which the submission window remains open for all staff.</p>
              <div className="flex gap-2">
                <input 
                  type="datetime-local" 
                  className="form-input text-xs"
                  value={capsForm.deadlineOverride || ''}
                  onChange={e => setCapsForm({...capsForm, deadlineOverride: e.target.value})}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => setCapsForm({...capsForm, deadlineOverride: null})}>Clear</button>
              </div>
            </div>
            
            <div className="divider"></div>
            
            <h4 className="text-xs font-bold">Custom Individual Caps</h4>
            <div className="flex flex-col gap-2">
              {capsForm.customCaps.map((c, i) => (
                <div key={i} className="flex items-center gap-3 bg-2 p-3 rounded-lg border border-3">
                  <div className="flex-1 text-xs font-medium">{staff.find(s => s.id === c.staffId)?.name || 'Unknown Staff'}</div>
                  <div className="px-2 py-1 bg-3 rounded text-[10px] font-bold uppercase">{c.label}</div>
                  <div className="text-xs font-bold">{c.cap}h</div>
                  <button 
                    className="btn btn-icon text-danger"
                    onClick={() => {
                      const next = capsForm.customCaps.filter((_, idx) => idx !== i)
                      setCapsForm({...capsForm, customCaps: next})
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                 <select className="form-input text-xs" id="custom-staff-select">
                    <option value="">Select Staff...</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
                 <input type="number" className="form-input w-20 text-xs" placeholder="Cap" id="custom-cap-val" />
                 <input type="text" className="form-input w-24 text-xs" placeholder="Label" id="custom-cap-label" defaultValue="custom" />
                 <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const sId = (document.getElementById('custom-staff-select') as HTMLSelectElement).value
                    const cVal = Number((document.getElementById('custom-cap-val') as HTMLInputElement).value)
                    const cLab = (document.getElementById('custom-cap-label') as HTMLInputElement).value
                    if (!sId || !cVal) return
                    const next = [...capsForm.customCaps, { staffId: sId, cap: cVal, label: cLab }]
                    setCapsForm({...capsForm, customCaps: next})
                  }}
                 >Add</button>
              </div>
            </div>

            <button className="btn btn-primary w-fit" onClick={() => saveAllSettings({ hourCaps: capsForm })}>
              Save Cap Settings
            </button>
          </div>
        )}

        {/* SUBMISSION WINDOW */}
        {tab === 'submission' && (
          <div className="flex flex-col gap-6">
            {/* Header Card */}
            <div className="card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-1">🔓 Submission Window</h3>
                  <p className="text-sm text-3">Configure timesheet submission schedule and penalties</p>
                </div>
                <button
                  onClick={() => setSubmissionWindowForm({...submissionWindowForm, enabled: !submissionWindowForm.enabled})}
                  className={`w-14 h-8 rounded-full relative transition-all ${submissionWindowForm.enabled ? 'bg-success' : 'bg-3'}`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${submissionWindowForm.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>
            </div>

            {submissionWindowForm.enabled && (
              <>
                {/* Active Window Schedule */}
                <div className="rounded-[32px] border-2 border-cyan-400/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className="text-sm font-bold mb-4 text-slate-200">Active Window:</div>
                    <div className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-6" style={{ fontSize: '3.5rem', fontWeight: '900' }}>
                      {titleCaseDay(submissionWindowForm.schedule.startDay)}, {submissionWindowForm.schedule.startTime.replace(/^0/, '')}
                      <span className="text-cyan-400/60"> - </span>
                      {titleCaseDay(submissionWindowForm.schedule.endDay)} {submissionWindowForm.schedule.endTime.replace(/^0/, '')}
                    </div>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <span className="text-lg font-bold text-slate-200">Timezone:</span>
                      <select
                        className="rounded-lg border-2 border-slate-600 bg-slate-800/80 px-4 py-2 text-base text-white font-bold focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all"
                        value={submissionWindowForm.timezone}
                        onChange={e => setSubmissionWindowForm({...submissionWindowForm, timezone: e.target.value})}
                      >
                        <option className="bg-slate-800" value="Africa/Windhoek">Africa/Windhoek</option>
                        <option className="bg-slate-800" value="Africa/Lagos">Africa/Lagos</option>
                        <option className="bg-slate-800" value="Africa/Johannesburg">Africa/Johannesburg</option>
                        <option className="bg-slate-800" value="UTC">UTC</option>
                        <option className="bg-slate-800" value="America/New_York">America/New_York</option>
                        <option className="bg-slate-800" value="Europe/London">Europe/London</option>
                      </select>
                    </div>
                  </div>

                  {/* Opens and Closes Sections - Side by Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Opens */}
                    <div className="rounded-[28px] border-2 border-slate-600/70 bg-slate-800/40 backdrop-blur-sm p-6 hover:border-cyan-400/50 transition-all">
                      <div className="text-center text-4xl font-black mb-6 text-white">Opens</div>

                      {/* Days */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
                        {scheduleDays.filter(d => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d.value)).map((day) => (
                          <button
                            key={day.value}
                            onClick={() => setSubmissionWindowForm({
                              ...submissionWindowForm,
                              schedule: { ...submissionWindowForm.schedule, startDay: day.value }
                            })}
                            className={`h-10 rounded-lg border-2 text-sm font-bold transition-all transform active:scale-95 ${
                              submissionWindowForm.schedule.startDay === day.value
                                ? 'border-white bg-white text-slate-900 shadow-lg scale-105'
                                : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                            }`}
                          >
                            {day.short}
                          </button>
                        ))}
                      </div>

                      {/* Time Input */}
                      <input
                        type="time"
                        className="w-full bg-slate-900/60 border-2 border-slate-600 rounded-2xl px-6 py-4 text-center text-5xl font-black text-white focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/30 transition-all"
                        style={{ width: '100%' }}
                        value={submissionWindowForm.schedule.startTime}
                        onChange={e => setSubmissionWindowForm({
                          ...submissionWindowForm,
                          schedule: { ...submissionWindowForm.schedule, startTime: e.target.value }
                        })}
                      />
                    </div>

                    {/* Closes */}
                    <div className="rounded-[28px] border-2 border-slate-600/70 bg-slate-800/40 backdrop-blur-sm p-6 hover:border-cyan-400/50 transition-all">
                      <div className="text-center text-4xl font-black mb-6 text-white">Closes</div>

                      {/* Days */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
                        {scheduleDays.filter(d => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d.value)).map((day) => (
                          <button
                            key={`end-${day.value}`}
                            onClick={() => setSubmissionWindowForm({
                              ...submissionWindowForm,
                              schedule: { ...submissionWindowForm.schedule, endDay: day.value }
                            })}
                            className={`h-10 rounded-lg border-2 text-sm font-bold transition-all transform active:scale-95 ${
                              submissionWindowForm.schedule.endDay === day.value
                                ? 'border-white bg-white text-slate-900 shadow-lg scale-105'
                                : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                            }`}
                          >
                            {day.short}
                          </button>
                        ))}
                      </div>

                      {/* Time Input */}
                      <input
                        type="time"
                        className="w-full bg-slate-900/60 border-2 border-slate-600 rounded-2xl px-6 py-4 text-center text-5xl font-black text-white focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/30 transition-all"
                        style={{ width: '100%' }}
                        value={submissionWindowForm.schedule.endTime}
                        onChange={e => setSubmissionWindowForm({
                          ...submissionWindowForm,
                          schedule: { ...submissionWindowForm.schedule, endTime: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>

                {/* Late Penalties */}
                <div className="card">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-bold mb-1">⚠️ Late Penalties</h4>
                      <p className="text-xs text-3">Deduct points for late submissions</p>
                    </div>
                    <button
                      onClick={() => setSubmissionWindowForm({
                        ...submissionWindowForm,
                        latePenalty: {...submissionWindowForm.latePenalty, enabled: !submissionWindowForm.latePenalty.enabled}
                      })}
                      className={`w-14 h-8 rounded-full relative transition-all ${submissionWindowForm.latePenalty.enabled ? 'bg-warning' : 'bg-3'}`}
                    >
                      <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${submissionWindowForm.latePenalty.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                  </div>

                  {submissionWindowForm.latePenalty.enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-3 mb-2 block">Points per Period</label>
                          <input
                            type="number"
                            className="form-input text-center text-xl font-bold w-full"
                            value={submissionWindowForm.latePenalty.pointsPerPeriod}
                            onChange={e => setSubmissionWindowForm({
                              ...submissionWindowForm,
                              latePenalty: {...submissionWindowForm.latePenalty, pointsPerPeriod: Number(e.target.value)}
                            })}
                            placeholder="-5"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-3 mb-2 block">Period Length (hours)</label>
                          <input
                            type="number"
                            className="form-input text-center text-xl font-bold w-full"
                            value={submissionWindowForm.latePenalty.periodHours}
                            onChange={e => setSubmissionWindowForm({
                              ...submissionWindowForm,
                              latePenalty: {...submissionWindowForm.latePenalty, periodHours: Number(e.target.value)}
                            })}
                            min="1"
                            placeholder="12"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="text-xs text-amber-900">
                          <span className="font-semibold">Example:</span> 25 hours late = <span className="font-bold">{Math.floor(25 / submissionWindowForm.latePenalty.periodHours) * submissionWindowForm.latePenalty.pointsPerPeriod} points</span> ({Math.floor(25 / submissionWindowForm.latePenalty.periodHours)} periods × {submissionWindowForm.latePenalty.pointsPerPeriod})
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Save Button */}
            <button
              className="btn btn-primary btn-lg w-full sm:w-auto"
              onClick={() => saveAllSettings({ submissionWindow: submissionWindowForm })}
            >
              Save Changes
            </button>
          </div>
        )}

        {/* WEEK LOCKING */}
        {tab === 'weeks' && (
          <div className="card flex flex-col gap-4">
            <h3 className="font-bold">🔐 Week Locking</h3>
            <p className="text-xs text-3">Locking a week range prevents all staff from adding or submitting entries during that period.</p>
            <div className="flex gap-2 p-4 bg-2 rounded-lg border border-3 mb-2 flex-wrap">
               <div className="flex items-center gap-2">
                 <label className="text-xs text-3 font-medium">From:</label>
                 <input type="date" className="form-input text-xs" id="lock-start-date" />
               </div>
               <div className="flex items-center gap-2">
                 <label className="text-xs text-3 font-medium">To:</label>
                 <input type="date" className="form-input text-xs" id="lock-end-date" />
               </div>
               <button
                className="btn btn-danger btn-sm whitespace-nowrap"
                onClick={() => {
                  const startDate = (document.getElementById('lock-start-date') as HTMLInputElement).value
                  const endDate = (document.getElementById('lock-end-date') as HTMLInputElement).value
                  if (!startDate) {
                    toast.error('Please select a start date')
                    return
                  }
                  // If no end date provided, use start date as single day lock
                  const finalEndDate = endDate || startDate
                  const weekId = startDate === finalEndDate ? startDate : `${startDate} to ${finalEndDate}`
                  const newLock: WeekLock = {
                    id: genId(),
                    weekId,
                    isLocked: true,
                    lockedBy: user?.name || 'Admin',
                    lockedAt: new Date().toISOString()
                  }
                  saveWeekLocks([...weekLocks, newLock])
                  logAudit('settings_change', weekId, { action: 'lock_week_range' })
                  toast.success(`Week range locked: ${weekId}`)
                }}
               >Lock Week Range</button>
            </div>
            <div className="grid gap-2">
              {weekLocks.length === 0 ? (
                <p className="text-xs text-4 py-4 text-center">No weeks currently locked.</p>
              ) : (
                weekLocks.map(lock => (
                  <div key={lock.id} className="flex items-center justify-between p-4 bg-soft-danger rounded-lg border border-danger-subtle">
                    <div>
                      <div className="text-xs font-bold text-danger">Locked: {lock.weekId}</div>
                      <div className="text-[10px] text-danger-subtle">By {lock.lockedBy} on {new Date(lock.lockedAt).toLocaleDateString()}</div>
                    </div>
                    <button 
                      className="btn btn-icon text-danger"
                      onClick={() => {
                        saveWeekLocks(weekLocks.filter(l => l.id !== lock.id))
                        toast.success(`Week ${lock.weekId} unlocked`)
                      }}
                    >
                      🔓 Unlock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PUBLIC HOLIDAYS */}
        {tab === 'holidays' && (
          <div className="card flex flex-col gap-4">
            <h3 className="font-bold">🏖️ Public Holidays</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <input type="text" className="form-input text-xs" id="holiday-name" placeholder="Holiday Name" />
              <input type="date" className="form-input text-xs" id="holiday-date" />
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const name = (document.getElementById('holiday-name') as HTMLInputElement).value
                  const date = (document.getElementById('holiday-date') as HTMLInputElement).value
                  if (!name || !date) return
                  const newHoliday: PublicHoliday = {
                    id: genId(),
                    name,
                    date,
                    capReduction: 8
                  }
                  savePublicHolidays([...publicHolidays, newHoliday])
                  toast.success('Holiday added')
                }}
              >Add Holiday</button>
            </div>
            <div className="grid gap-2">
              {publicHolidays.map(h => (
                <div key={h.id} className="flex items-center justify-between p-3 bg-2 rounded-xl border border-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-soft-primary flex items-center justify-center text-primary text-xs font-bold">🏖️</div>
                    <div>
                      <div className="text-xs font-bold">{h.name}</div>
                      <div className="text-[10px] text-3">{new Date(h.date).toLocaleDateString()} · -{h.capReduction}h cap reduction</div>
                    </div>
                  </div>
                  <button 
                    className="btn btn-icon text-danger"
                    onClick={() => savePublicHolidays(publicHolidays.filter(x => x.id !== h.id))}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}






        {/* SECURITY & PASSWORDS */}
        {tab === 'security' && (
          <div className="card flex flex-col gap-6">
            <h3 className="font-bold">🛡️ Security & Access Control</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Default New User Password</label>
                <div className="flex gap-2">
                  <input 
                    className="form-input" 
                    type="text"
                    value={securityForm.defaultPassword}
                    onChange={e => setSecurityForm({...securityForm, defaultPassword: e.target.value})}
                  />
                </div>
                <p className="text-[10px] text-3 mt-1">This password will be assigned to all new users and during administrative resets.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Active Features</label>
                <div className="flex items-center gap-3 p-3 bg-2 rounded-lg border border-3">
                   <button
                    onClick={() => setSecurityForm({...securityForm, requireTwoFactor: !securityForm.requireTwoFactor})}
                    className={`w-10 h-5 rounded-full relative transition-all ${securityForm.requireTwoFactor ? 'bg-success' : 'bg-3'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${securityForm.requireTwoFactor ? 'left-6' : 'left-1'}`}></div>
                  </button>
                  <span className="text-xs font-medium">Require 2FA for Admin/Leads</span>
                </div>
              </div>
            </div>
            <button className="btn btn-primary w-fit" onClick={() => saveAllSettings({ security: securityForm })}>
              Save Security Settings
            </button>
          </div>
        )}

        {/* ACTIVITY LOG */}
        {tab === 'activity' && (
          <div className="card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">📜 Platform Activity Log</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const data = filteredAuditLogs.map(l => ({
                    Timestamp: l.timestamp,
                    User: l.performedBy,
                    Action: l.action,
                    Target: l.targetId,
                    Device: l.device,
                    IP: l.ipAddress,
                    Metadata: JSON.stringify(l.metadata || {}),
                  }))
                  exportCSV(data, `platform_activity_${new Date().toISOString().slice(0, 10)}.csv`)
                }}
              >
                Export CSV
              </button>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <input
                className="form-input text-xs flex-1"
                style={{ minWidth: '200px' }}
                placeholder="Search user/action/target/details..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
              />
              <select className="form-select text-xs" style={{ minWidth: '150px' }} value={auditAction} onChange={e => setAuditAction(e.target.value)}>
                <option value="">All Actions</option>
                {actionOptions.map((action: string) => <option key={action} value={action}>{action}</option>)}
              </select>
              <input className="form-input text-xs" style={{ width: '140px' }} type="date" placeholder="dd----yyyy" value={auditFrom} onChange={e => setAuditFrom(e.target.value)} />
              <input className="form-input text-xs" style={{ width: '140px' }} type="date" placeholder="dd----yyyy" value={auditTo} onChange={e => setAuditTo(e.target.value)} />
            </div>
            <div className="text-xs text-3">
              Showing {filteredAuditLogs.length} log event{filteredAuditLogs.length === 1 ? '' : 's'} from Firebase.
            </div>
            <div className="table-wrap" style={{ maxHeight: 600 }}>
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Device</th>
                    <th>IP</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map(log => (
                    <tr key={log.id}>
                      <td className="text-xs font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="font-medium">{log.performedBy || 'System'}</td>
                      <td><span className="badge badge-blue">{log.action}</span></td>
                      <td className="text-xs">{log.targetId || '—'}</td>
                      <td className="text-xs" title={log.device || ''}>
                        <div className="truncate max-w-[220px]">{log.device || '—'}</div>
                      </td>
                      <td className="text-xs font-mono">{log.ipAddress || '—'}</td>
                      <td className="text-xs">
                        <div className="truncate max-w-[320px]" title={JSON.stringify(log.metadata || {})}>
                          {JSON.stringify(log.metadata || {})}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-4">No logs match current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DATABASE */}
        {tab === 'database' && (
          <div className="flex flex-col gap-6">
            <div className="card flex flex-col gap-4">
              <h3 className="font-bold">🗄️ Firestore Database Statistics</h3>
              <p className="text-xs text-3">Real-time collection counts and estimated storage size</p>

              <div className="overflow-x-auto border border-3 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-2">
                    <tr>
                      <th className="p-3 text-left font-bold uppercase text-[10px]">Collection</th>
                      <th className="p-3 text-right font-bold uppercase text-[10px]">Documents</th>
                      <th className="p-3 text-right font-bold uppercase text-[10px]">Est. Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'staff', count: staff?.length || 0, data: staff },
                      { name: 'timesheetEntries', count: entries?.length || 0, data: entries },
                      { name: 'leaves', count: leaves?.length || 0, data: leaves },
                      { name: 'notifications', count: nots?.length || 0, data: nots },
                      { name: 'auditLogs', count: auditLogs?.length || 0, data: auditLogs },
                      { name: 'rewards', count: rewards?.length || 0, data: rewards },
                      { name: 'redeems', count: redeems?.length || 0, data: redeems },
                      { name: 'announcements', count: announcements?.length || 0, data: announcements },
                      { name: 'publicHolidays', count: publicHolidays?.length || 0, data: publicHolidays },
                      { name: 'weekLocks', count: weekLocks?.length || 0, data: weekLocks },
                      { name: 'projects', count: projects?.length || 0, data: projects },
                      { name: 'settings', count: 1, data: settings }
                    ].map(({ name, count, data }) => {
                      const estimatedSize = data ? (JSON.stringify(data).length / 1024).toFixed(2) : '0.00'
                      return (
                        <tr key={name} className="border-t border-3">
                          <td className="p-3 font-mono font-bold">{name}</td>
                          <td className="p-3 text-right">{count.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{estimatedSize} KB</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-3 bg-2 font-bold">
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right">
                        {[
                          staff?.length || 0,
                          entries?.length || 0,
                          leaves?.length || 0,
                          nots?.length || 0,
                          auditLogs?.length || 0,
                          rewards?.length || 0,
                          redeems?.length || 0,
                          announcements?.length || 0,
                          publicHolidays?.length || 0,
                          weekLocks?.length || 0,
                          projects?.length || 0,
                          1
                        ].reduce((sum, n) => sum + n, 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {(
                          [staff, entries, leaves, nots, auditLogs, rewards, redeems, announcements, publicHolidays, weekLocks, projects, settings]
                            .filter(Boolean)
                            .reduce((sum, data) => sum + JSON.stringify(data).length, 0) / 1024
                        ).toFixed(2)} KB
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-soft-info rounded-lg text-xs text-info">
                ℹ️ Data is synced in real-time from Firestore. Size estimates are based on JSON serialization and may differ from actual Firestore storage calculations.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
