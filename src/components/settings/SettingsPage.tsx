'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { exportCSV, genId } from '../../lib/utils'
import { AppSettings, WeekLock, PublicHoliday } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import {
  Settings, Target, BarChart3, Clock, CheckSquare, Lock, Unlock, Calendar,
  CalendarDays, Palmtree, Shield, ScrollText, Database, Save, Trash2, Plus, Download
} from 'lucide-react'

export default function SettingsPage() {
  const {
    settings, saveSettings, user, logAudit,
    weekLocks, saveWeekLocks,
    auditLogs,
    publicHolidays, savePublicHolidays,
    staff,
    entries,
    nots,
    rewards,
    redeems,
    announcements,
    projects
  } = useApp()

  const [tab, setTab] = useState<string>('points')
  const [holidayConfirm, setHolidayConfirm] = useState<{ isOpen: boolean; action: () => void; message: string; title?: string }>({ isOpen: false, action: () => {}, message: '' })
  const [pendingHoliday, setPendingHoliday] = useState<{ name: string; date: string } | null>(null)

  // Local form state
  const [pointsForm, setPointsForm] = useState({
    earlySubmission: settings?.pointsConfig?.earlySubmission ?? 3,
    onTimeSubmission: settings?.pointsConfig?.onTimeSubmission ?? 2,
    lateAddition: settings?.pointsConfig?.lateAddition ?? 1,
    outsideWindowPenalty: settings?.pointsConfig?.outsideWindowPenalty ?? -1,
    earlySubmissionHours: settings?.pointsConfig?.earlySubmissionHours ?? 4,
  })
  const [capsForm, setCapsForm] = useState(settings?.hourCaps || { defaultStaffCap: 40, internCap: 32, cdsVisibility: true, customCaps: [] })
  const [securityForm, setSecurityForm] = useState(settings?.security || { defaultPassword: 'dsn-staff', requireTwoFactor: false })
  const [submissionWindowForm, setSubmissionWindowForm] = useState(settings?.submissionWindow || {
    enabled: true,
    schedule: { startDay: 'monday' as const, startTime: '08:00', endDay: 'tuesday' as const, endTime: '16:00' },
    latePenalty: { enabled: true, pointsPerPeriod: -5, periodHours: 12 },
    timezone: 'Africa/Lagos'
  })
  const [reviewWindowForm, setReviewWindowForm] = useState(settings?.reviewWindow || {
    enabled: true,
    hoursAfterClose: 24,
    penaltyPerEntry: -5,
  })
  const [auditSearch, setAuditSearch] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')

  const tabs = [
    { id: 'points', label: 'Points' },
    { id: 'caps', label: 'Caps' },
    { id: 'submission', label: 'Submission Window' },
    { id: 'review', label: 'Review Window' },
    { id: 'weeks', label: 'Weeks' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'security', label: 'Security' },
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
    if (settings?.submissionWindow) setSubmissionWindowForm(settings.submissionWindow)
  }, [settings?.submissionWindow])

  useEffect(() => {
    if (settings?.reviewWindow) setReviewWindowForm(settings.reviewWindow)
  }, [settings?.reviewWindow])

  const saveAllSettings = (updates: Partial<AppSettings>) => {
    const newData = { ...settings, ...updates } as AppSettings
    saveSettings(newData)
    logAudit('settings_change', 'system', { updates: Object.keys(updates) })
    toast.success('Settings updated')
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

  // --- 2026 design helpers ---
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }
  const helperStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 7 }
  const inputStyle = (opts?: { mono?: boolean; danger?: boolean }): React.CSSProperties => ({
    width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
    fontFamily: opts?.mono ? 'var(--mono)' : 'inherit', fontSize: 14, fontWeight: 700,
    color: opts?.danger ? 'var(--danger)' : 'var(--ink)', background: 'var(--surface)', outline: 'none'
  })
  const cardShell: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--sh-sm)', overflow: 'hidden'
  }
  const cardHead: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 11, padding: '18px 24px', borderBottom: '1px solid var(--line-2)'
  }
  const cardBody: React.CSSProperties = { padding: '22px 24px' }
  const iconTile = (tint: string, color: string): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 9, background: tint, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  })
  const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--ink)' }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 20px' }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px 20px' }
  const subHead: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }
  const subDesc: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }
  const rubricLine: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink-4)', fontStyle: 'italic', marginTop: 4 }
  const saveBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', border: 'none', borderRadius: 'var(--r-sm)',
    background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(12,122,55,.25)'
  }
  const discardBtn: React.CSSProperties = {
    padding: '11px 18px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
    background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
  }
  const saveFooter: React.CSSProperties = {
    display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--line-2)', background: 'var(--canvas)'
  }
  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <div onClick={onClick} style={{ width: 38, height: 22, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--line)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.3)', transition: 'left .15s' }} />
    </div>
  )
  const ToggleRow = ({ title, desc, on, onClick }: { title: string; desc: string; on: boolean; onClick: () => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--canvas)', borderRadius: 'var(--r-sm)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{desc}</div>
      </div>
      <Toggle on={on} onClick={onClick} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
          <Settings size={23} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>System Settings</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>Platform configuration and administrative control</p>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--line)', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '11px 15px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
                fontWeight: active ? 700 : 600, color: active ? 'var(--brand)' : 'var(--ink-3)'
              }}
            >
              {t.label}
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, background: active ? 'var(--brand)' : 'transparent', borderRadius: 2 }} />
            </div>
          )
        })}
      </div>

      <div className="grid gap-6">


        {/* POINTS CONFIG */}
        {tab === 'points' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--gold-tint)', 'var(--gold)')}><Target size={17} /></span>
              <div style={cardTitle}>Points &amp; Awards Configuration</div>
            </div>
            <div style={cardBody}>
              <div style={subHead}>Submission Points</div>
              <div style={subDesc}>Points awarded when staff submit their weekly timesheet.</div>
              <div style={rubricLine}>
                Rubric: Early ({pointsForm.earlySubmissionHours}h from window open) → On-time → Late addition → Outside window
              </div>
              <div style={{ ...grid3, marginTop: 18 }}>
                {([
                  { key: 'earlySubmission', label: 'Early Submission', hint: `Within first ${pointsForm.earlySubmissionHours}h of window opening` },
                  { key: 'earlySubmissionHours', label: 'Early Window (hours)', hint: 'Hours from window open that count as early' },
                  { key: 'onTimeSubmission', label: 'On-Time Submission', hint: 'Within submission window (after early cutoff)' },
                  { key: 'lateAddition', label: 'Late Addition', hint: 'Submitted after window closes' },
                  { key: 'outsideWindowPenalty', label: 'Outside Window Penalty', hint: 'Submitted outside any window period' },
                ] as { key: keyof typeof pointsForm, label: string, hint: string }[]).map(({ key, label, hint }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input type="number" style={inputStyle({ mono: true, danger: Number(pointsForm[key]) < 0 })} value={pointsForm[key]}
                      onChange={e => setPointsForm({ ...pointsForm, [key]: Number(e.target.value) })} />
                    <div style={helperStyle}>{hint}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={saveFooter}>
              <button style={saveBtn} onClick={() => saveAllSettings({ pointsConfig: pointsForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* HOUR CAPS */}
        {tab === 'caps' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--info-tint)', 'var(--info)')}><BarChart3 size={17} /></span>
              <div style={cardTitle}>Hour Caps &amp; Visibility</div>
            </div>
            <div style={cardBody}>
              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Default Staff Cap (hrs)</label>
                  <input
                    type="number"
                    style={inputStyle({ mono: true })}
                    value={capsForm.defaultStaffCap}
                    onChange={e => setCapsForm({ ...capsForm, defaultStaffCap: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Intern Cap (hrs)</label>
                  <input
                    type="number"
                    style={inputStyle({ mono: true })}
                    value={capsForm.internCap}
                    onChange={e => setCapsForm({ ...capsForm, internCap: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <ToggleRow
                  title="CDS Day Visibility"
                  desc="Show CDS Day selection in staff profiles."
                  on={!!capsForm.cdsVisibility}
                  onClick={() => setCapsForm({ ...capsForm, cdsVisibility: !capsForm.cdsVisibility })}
                />
              </div>

              <div style={{ marginTop: 16, padding: 16, background: 'var(--warn-tint)', borderRadius: 'var(--r-sm)', border: '1px solid var(--warning-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarDays size={15} style={{ color: 'var(--warn)' }} />
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warn)' }}>Emergency Deadline Extension</div>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>Sets a custom date/time until which the submission window remains open for all staff.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    type="datetime-local"
                    style={{ ...inputStyle(), width: 'auto', flex: 1 }}
                    value={capsForm.deadlineOverride || ''}
                    onChange={e => setCapsForm({ ...capsForm, deadlineOverride: e.target.value })}
                  />
                  <button style={discardBtn} onClick={() => setCapsForm({ ...capsForm, deadlineOverride: null })}>Clear</button>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--line-2)', margin: '22px 0' }} />

              <div style={subHead}>Custom Individual Caps</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {capsForm.customCaps.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--canvas)', padding: '12px 14px', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{staff.find(s => s.id === c.staffId)?.name || 'Unknown Staff'}</div>
                    <div style={{ padding: '3px 8px', background: 'var(--elev)', borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-2)' }}>{c.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{c.cap}h</div>
                    <button
                      style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
                      onClick={() => {
                        const next = capsForm.customCaps.filter((_, idx) => idx !== i)
                        setCapsForm({ ...capsForm, customCaps: next })
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <select style={{ ...inputStyle(), flex: 1 }} id="custom-staff-select">
                    <option value="">Select Staff...</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input type="number" style={{ ...inputStyle({ mono: true }), width: 90 }} placeholder="Cap" id="custom-cap-val" />
                  <input type="text" style={{ ...inputStyle(), width: 120 }} placeholder="Label" id="custom-cap-label" defaultValue="custom" />
                  <button
                    style={discardBtn}
                    onClick={() => {
                      const sId = (document.getElementById('custom-staff-select') as HTMLSelectElement).value
                      const cVal = Number((document.getElementById('custom-cap-val') as HTMLInputElement).value)
                      const cLab = (document.getElementById('custom-cap-label') as HTMLInputElement).value
                      if (!sId || !cVal) return
                      const next = [...capsForm.customCaps, { staffId: sId, cap: cVal, label: cLab }]
                      setCapsForm({ ...capsForm, customCaps: next })
                    }}
                  >Add</button>
                </div>
              </div>
            </div>
            <div style={saveFooter}>
              <button style={saveBtn} onClick={() => saveAllSettings({ hourCaps: capsForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* SUBMISSION WINDOW */}
        {tab === 'submission' && (
          <div className="flex flex-col gap-6">
            {/* Header Card */}
            <div style={cardShell}>
              <div style={{ ...cardHead, borderBottom: 'none', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={iconTile('var(--tint)', 'var(--brand)')}><Clock size={17} /></span>
                  <div>
                    <div style={cardTitle}>Submission Window</div>
                    <div style={subDesc}>Configure timesheet submission schedule and penalties</div>
                  </div>
                </div>
                <Toggle on={submissionWindowForm.enabled} onClick={() => setSubmissionWindowForm({ ...submissionWindowForm, enabled: !submissionWindowForm.enabled })} />
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
                        onChange={e => setSubmissionWindowForm({ ...submissionWindowForm, timezone: e.target.value })}
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
                            className={`h-10 rounded-lg border-2 text-sm font-bold transition-all transform active:scale-95 ${submissionWindowForm.schedule.startDay === day.value
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
                            className={`h-10 rounded-lg border-2 text-sm font-bold transition-all transform active:scale-95 ${submissionWindowForm.schedule.endDay === day.value
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
                <div style={cardShell}>
                  <div style={{ ...cardHead, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={iconTile('var(--warn-tint)', 'var(--warn)')}><Clock size={17} /></span>
                      <div>
                        <div style={cardTitle}>Late Penalties</div>
                        <div style={subDesc}>Deduct points for late submissions</div>
                      </div>
                    </div>
                    <Toggle
                      on={submissionWindowForm.latePenalty.enabled}
                      onClick={() => setSubmissionWindowForm({
                        ...submissionWindowForm,
                        latePenalty: { ...submissionWindowForm.latePenalty, enabled: !submissionWindowForm.latePenalty.enabled }
                      })}
                    />
                  </div>

                  {submissionWindowForm.latePenalty.enabled && (
                    <div style={cardBody}>
                      <div style={grid2}>
                        <div>
                          <label style={labelStyle}>Points per Period</label>
                          <input
                            type="number"
                            style={inputStyle({ mono: true, danger: submissionWindowForm.latePenalty.pointsPerPeriod < 0 })}
                            value={submissionWindowForm.latePenalty.pointsPerPeriod}
                            onChange={e => setSubmissionWindowForm({
                              ...submissionWindowForm,
                              latePenalty: { ...submissionWindowForm.latePenalty, pointsPerPeriod: Number(e.target.value) }
                            })}
                            placeholder="-5"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Period Length (hours)</label>
                          <input
                            type="number"
                            style={inputStyle({ mono: true })}
                            value={submissionWindowForm.latePenalty.periodHours}
                            onChange={e => setSubmissionWindowForm({
                              ...submissionWindowForm,
                              latePenalty: { ...submissionWindowForm.latePenalty, periodHours: Number(e.target.value) }
                            })}
                            min="1"
                            placeholder="12"
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 16, padding: 14, background: 'var(--warn-tint)', borderRadius: 'var(--r-sm)', border: '1px solid var(--warning-subtle)' }}>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                          <span style={{ fontWeight: 700 }}>Example:</span> 25 hours late = <span style={{ fontWeight: 700 }}>{Math.floor(25 / submissionWindowForm.latePenalty.periodHours) * submissionWindowForm.latePenalty.pointsPerPeriod} points</span> ({Math.floor(25 / submissionWindowForm.latePenalty.periodHours)} periods × {submissionWindowForm.latePenalty.pointsPerPeriod})
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={saveBtn} onClick={() => saveAllSettings({ submissionWindow: submissionWindowForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* REVIEW WINDOW */}
        {tab === 'review' && (
          <div className="flex flex-col gap-6">
            {/* Header Card */}
            <div style={cardShell}>
              <div style={{ ...cardHead, borderBottom: 'none', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={iconTile('var(--violet-tint)', 'var(--violet)')}><CheckSquare size={17} /></span>
                  <div>
                    <div style={cardTitle}>Review Window</div>
                    <div style={subDesc}>Configure how long team leads have to review submitted timesheets after the submission window closes. Late reviews incur point deductions.</div>
                  </div>
                </div>
                <Toggle on={reviewWindowForm.enabled} onClick={() => setReviewWindowForm({ ...reviewWindowForm, enabled: !reviewWindowForm.enabled })} />
              </div>
            </div>

            {reviewWindowForm.enabled && (
              <>
                {/* Visual display */}
                <div className="rounded-[32px] border-2 border-emerald-400/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
                  <div className="text-center mb-8">
                    <div className="text-sm font-bold mb-4 text-slate-200">Review Deadline:</div>
                    <div className="text-5xl font-black tracking-tight leading-tight mb-4">
                      Submission close + <span className="text-emerald-400">{reviewWindowForm.hoursAfterClose}h</span>
                    </div>
                    <p className="text-slate-400 text-sm">Team leads receive an email when the submission window closes and must complete all reviews within this window.</p>
                  </div>

                  <div className="rounded-[20px] border-2 border-slate-600/70 bg-slate-800/40 p-6">
                    <label className="text-center text-2xl font-black mb-6 text-white block">Hours to Review</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      className="w-full bg-slate-900/60 border-2 border-slate-600 rounded-2xl px-6 py-4 text-center text-5xl font-black text-white focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-400/30 transition-all"
                      value={reviewWindowForm.hoursAfterClose}
                      onChange={e => setReviewWindowForm({ ...reviewWindowForm, hoursAfterClose: Number(e.target.value) })}
                    />
                    <p className="text-slate-400 text-sm text-center mt-3">Maximum 168h (1 week)</p>
                  </div>
                </div>

                {/* Late review penalty */}
                <div style={cardShell}>
                  <div style={cardHead}>
                    <span style={iconTile('var(--warn-tint)', 'var(--warn)')}><CheckSquare size={17} /></span>
                    <div>
                      <div style={cardTitle}>Late Review Penalty</div>
                      <div style={subDesc}>Points deducted per unreviewed entry after the review deadline passes. Applied once automatically.</div>
                    </div>
                  </div>
                  <div style={cardBody}>
                    <div style={grid2}>
                      <div>
                        <label style={labelStyle}>Points per Unreviewed Entry</label>
                        <input
                          type="number"
                          style={inputStyle({ mono: true, danger: reviewWindowForm.penaltyPerEntry < 0 })}
                          value={reviewWindowForm.penaltyPerEntry}
                          onChange={e => setReviewWindowForm({ ...reviewWindowForm, penaltyPerEntry: Number(e.target.value) })}
                          placeholder="-5"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ padding: 14, background: 'var(--warn-tint)', borderRadius: 'var(--r-sm)', border: '1px solid var(--warning-subtle)', width: '100%' }}>
                          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                            <span style={{ fontWeight: 700 }}>Example:</span> A lead with 10 unreviewed entries would lose <span style={{ fontWeight: 700 }}>{Math.abs(reviewWindowForm.penaltyPerEntry) * 10} points</span> ({reviewWindowForm.penaltyPerEntry} × 10 entries)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* How it works */}
                <div style={{ ...cardShell, background: 'var(--elev)' }}>
                  <div style={cardHead}>
                    <span style={iconTile('var(--info-tint)', 'var(--info)')}><ScrollText size={17} /></span>
                    <div style={cardTitle}>How it works</div>
                  </div>
                  <ol style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 8, padding: '22px 24px', paddingLeft: 40, listStyle: 'none' }}>
                    <li>1. Submission window closes (e.g. Tuesday 12:57 PM)</li>
                    <li>2. All team leads immediately receive an email listing their pending entries and the review deadline</li>
                    <li>3. Leads have <strong>{reviewWindowForm.hoursAfterClose} hours</strong> to approve or reject all submitted entries</li>
                    <li>4. After the deadline, <strong>{reviewWindowForm.penaltyPerEntry} points</strong> is deducted per unreviewed entry from each responsible lead</li>
                    <li>5. A live countdown banner appears on the Approvals page for all leads and admins</li>
                  </ol>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={saveBtn} onClick={() => saveAllSettings({ reviewWindow: reviewWindowForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* WEEK LOCKING */}
        {tab === 'weeks' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--tint)', 'var(--brand)')}><Lock size={17} /></span>
              <div style={cardTitle}>Week Locking</div>
            </div>
            <div style={cardBody}>
            <p style={{ ...subDesc, marginTop: 0, marginBottom: 14 }}>Locking a week range prevents all staff from adding or submitting entries during that period.</p>
            <div style={{ display: 'flex', gap: 12, padding: 16, background: 'var(--canvas)', borderRadius: 'var(--r-sm)', marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>From</label>
                <input type="date" style={inputStyle()} id="lock-start-date" />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <input type="date" style={inputStyle()} id="lock-end-date" />
              </div>
              <button
                style={{ ...saveBtn, background: 'var(--danger)', boxShadow: '0 3px 10px rgba(216,71,63,.25)', whiteSpace: 'nowrap' }}
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
              ><Lock size={15} /> Lock Week Range</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weekLocks.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '16px 0', textAlign: 'center' }}>No weeks currently locked.</p>
              ) : (
                weekLocks.map(lock => (
                  <div key={lock.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--danger-tint)', borderRadius: 'var(--r-sm)', border: '1px solid var(--danger-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={iconTile('var(--danger-tint)', 'var(--danger)')}><Lock size={15} /></span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>Locked: {lock.weekId}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>By {lock.lockedBy} on {new Date(lock.lockedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <button
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--danger-subtle)', background: 'var(--surface)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                      onClick={() => {
                        saveWeekLocks(weekLocks.filter(l => l.id !== lock.id))
                        toast.success(`Week ${lock.weekId} unlocked`)
                      }}
                    >
                      <Unlock size={14} /> Unlock
                    </button>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        )}

        {/* PUBLIC HOLIDAYS */}
        {tab === 'holidays' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--warn-tint)', 'var(--warn)')}><Palmtree size={17} /></span>
              <div style={cardTitle}>Public Holidays</div>
            </div>
            <div style={cardBody}>
            <div style={{ ...grid3, marginBottom: 18, alignItems: 'end' }}>
              <input type="text" style={inputStyle()} id="holiday-name" placeholder="Holiday Name" />
              <input type="date" style={inputStyle()} id="holiday-date" />
              <button
                style={saveBtn}
                onClick={() => {
                  const name = (document.getElementById('holiday-name') as HTMLInputElement).value
                  const date = (document.getElementById('holiday-date') as HTMLInputElement).value
                  if (!name || !date) return
                  setHolidayConfirm({
                    isOpen: true,
                    title: 'Add Holiday',
                    message: `Add "${name}" on ${new Date(date).toLocaleDateString()}?`,
                    action: () => {
                      const newHoliday: PublicHoliday = {
                        id: genId(),
                        name,
                        date,
                        capReduction: 8
                      }
                      savePublicHolidays([...publicHolidays, newHoliday])
                      toast.success('Holiday added')
                    }
                  })
                }}
              ><Plus size={15} /> Add Holiday</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {publicHolidays.map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--canvas)', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={iconTile('var(--warn-tint)', 'var(--warn)')}><Palmtree size={15} /></span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{h.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(h.date).toLocaleDateString()} · -{h.capReduction}h cap reduction</div>
                    </div>
                  </div>
                  <button
                    style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
                    onClick={() => setHolidayConfirm({
                      isOpen: true,
                      title: 'Delete Holiday',
                      message: `Delete "${h.name}"? This cannot be undone.`,
                      action: () => {
                        savePublicHolidays(publicHolidays.filter(x => x.id !== h.id))
                        toast.success('Holiday deleted')
                      }
                    })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}






        {/* SECURITY & PASSWORDS */}
        {tab === 'security' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--danger-tint)', 'var(--danger)')}><Shield size={17} /></span>
              <div style={cardTitle}>Security &amp; Access Control</div>
            </div>
            <div style={cardBody}>
              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Default New User Password</label>
                  <input
                    style={inputStyle()}
                    type="text"
                    value={securityForm.defaultPassword}
                    onChange={e => setSecurityForm({ ...securityForm, defaultPassword: e.target.value })}
                  />
                  <div style={helperStyle}>This password will be assigned to all new users and during administrative resets.</div>
                </div>
                <div>
                  <label style={labelStyle}>Active Features</label>
                  <ToggleRow
                    title="Require 2FA for Admin/Leads"
                    desc="Enforce two-factor authentication on privileged accounts."
                    on={!!securityForm.requireTwoFactor}
                    onClick={() => setSecurityForm({ ...securityForm, requireTwoFactor: !securityForm.requireTwoFactor })}
                  />
                </div>
              </div>
            </div>
            <div style={saveFooter}>
              <button style={saveBtn} onClick={() => saveAllSettings({ security: securityForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* ACTIVITY LOG */}
        {/* DATABASE */}
        {tab === 'database' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--elev)', 'var(--ink-2)')}><Database size={17} /></span>
              <div>
                <div style={cardTitle}>PostgreSQL Database Statistics</div>
                <div style={subDesc}>Real-time collection counts and estimated storage size</div>
              </div>
            </div>
            <div style={cardBody}>
              <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                <table className="w-full text-xs">
                  <thead style={{ background: 'var(--canvas)' }}>
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
                        <tr key={name} style={{ borderTop: '1px solid var(--line-2)' }}>
                          <td className="p-3 font-mono font-bold">{name}</td>
                          <td className="p-3 text-right">{count.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{estimatedSize} KB</td>
                        </tr>
                      )
                    })}
                    <tr className="font-bold" style={{ borderTop: '2px solid var(--line)', background: 'var(--canvas)' }}>
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right">
                        {[
                          staff?.length || 0,
                          entries?.length || 0,
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
                          [staff, entries, nots, auditLogs, rewards, redeems, announcements, publicHolidays, weekLocks, projects, settings]
                            .filter(Boolean)
                            .reduce((sum, data) => sum + JSON.stringify(data).length, 0) / 1024
                        ).toFixed(2)} KB
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, padding: 14, background: 'var(--info-tint)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--info)' }}>
                Data is synced in real-time (every 30s) from the PostgreSQL Database. Size estimates are based on JSON serialization and may differ from actual storage calculations.
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={holidayConfirm.isOpen}
        title={holidayConfirm.title}
        message={holidayConfirm.message}
        onConfirm={() => { holidayConfirm.action(); setHolidayConfirm({ isOpen: false, action: () => {}, message: '' }) }}
        onCancel={() => setHolidayConfirm({ isOpen: false, action: () => {}, message: '' })}
      />
    </div>
  )
}
