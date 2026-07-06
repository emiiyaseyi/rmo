'use client'
import React, { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { exportCSV, genId, avatarColor, initials, fmtDate, timeAgo } from '../../lib/utils'
import { AppSettings, WeekLock, PublicHoliday } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'
import {
  Settings, Target, BarChart3, Clock, CheckSquare, Lock, Unlock, Flame,
  CalendarDays, Shield, ScrollText, Database, Save, Trash2, Plus, Download,
  FileText, Users, BarChart, Check, X, AlertTriangle
} from 'lucide-react'

export default function SettingsPage() {
  const {
    settings, saveSettings, user, logAudit,
    weekLocks, saveWeekLocks,
    publicHolidays, savePublicHolidays,
    staff,
    saveStaff,
    entries,
    leaves,
    notify,
    passwordResetRequests,
    savePasswordResetRequests
  } = useApp()

  const [tab, setTab] = useState<string>('points')
  const [holidayConfirm, setHolidayConfirm] = useState<{ isOpen: boolean; action: () => void; message: string; title?: string }>({ isOpen: false, action: () => {}, message: '' })
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayDraft, setHolidayDraft] = useState<{ name: string; date: string; type: 'public' | 'internal' }>({ name: '', date: '', type: 'public' })

  // Local form state
  const [pointsForm, setPointsForm] = useState({
    earlySubmission: settings?.pointsConfig?.earlySubmission ?? 3,
    onTimeSubmission: settings?.pointsConfig?.onTimeSubmission ?? 2,
    outsideWindowPenalty: settings?.pointsConfig?.outsideWindowPenalty ?? -1,
    earlySubmissionHours: settings?.pointsConfig?.earlySubmissionHours ?? 4,
    fullWeekBonus: settings?.pointsConfig?.fullWeekBonus ?? 50,
    streakBonus: settings?.pointsConfig?.streakBonus ?? 25,
    approvalBonus: settings?.pointsConfig?.approvalBonus ?? 5,
  })
  const [capsForm, setCapsForm] = useState({
    defaultStaffCap: settings?.hourCaps?.defaultStaffCap ?? 40,
    internCap: settings?.hourCaps?.internCap ?? 32,
    cdsVisibility: settings?.hourCaps?.cdsVisibility ?? true,
    customCaps: settings?.hourCaps?.customCaps ?? [],
    deadlineOverride: settings?.hourCaps?.deadlineOverride ?? null,
    maxHoursPerDay: settings?.hourCaps?.maxHoursPerDay ?? 12,
    maxHoursPerWeek: settings?.hourCaps?.maxHoursPerWeek ?? 60,
    minHoursPerWeek: settings?.hourCaps?.minHoursPerWeek ?? 35,
    weeklyPointsCap: settings?.hourCaps?.weeklyPointsCap ?? 200,
    dailyEntryLimit: settings?.hourCaps?.dailyEntryLimit ?? 8,
    backdatingLimitDays: settings?.hourCaps?.backdatingLimitDays ?? 14,
  })
  const [securityForm, setSecurityForm] = useState({
    defaultPassword: settings?.security?.defaultPassword ?? 'dsn-staff',
    requireTwoFactor: settings?.security?.requireTwoFactor ?? false,
    autoLogoutIdle: settings?.security?.autoLogoutIdle ?? true,
    minPasswordLength: settings?.security?.minPasswordLength ?? 8,
    passwordExpiryDays: settings?.security?.passwordExpiryDays ?? 90,
    sessionTimeoutMin: settings?.security?.sessionTimeoutMin ?? 30,
  })
  const [submissionWindowForm, setSubmissionWindowForm] = useState(settings?.submissionWindow || {
    enabled: true,
    schedule: { startDay: 'monday' as const, startTime: '08:00', endDay: 'tuesday' as const, endTime: '16:00' },
    latePenalty: { enabled: true, pointsPerPeriod: -5, periodHours: 12 },
    gracePeriodHours: 6,
    timezone: 'Africa/Lagos'
  })
  const [reviewWindowForm, setReviewWindowForm] = useState({
    enabled: settings?.reviewWindow?.enabled ?? true,
    hoursAfterClose: settings?.reviewWindow?.hoursAfterClose ?? 24,
    penaltyPerEntry: settings?.reviewWindow?.penaltyPerEntry ?? -5,
    autoApprove: settings?.reviewWindow?.autoApprove ?? false,
    schedule: settings?.reviewWindow?.schedule ?? { openDay: 'tuesday', openTime: '16:00', closeDay: 'wednesday', closeTime: '16:00' },
  })
  const [lastBackup, setLastBackup] = useState<string>('Today at 03:00 WAT · automatic')
  const [recalcConfirm, setRecalcConfirm] = useState(false)
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

  useEffect(() => {
    if (settings?.submissionWindow) setSubmissionWindowForm({ gracePeriodHours: 6, ...settings.submissionWindow })
  }, [settings?.submissionWindow])

  useEffect(() => {
    if (settings?.reviewWindow) setReviewWindowForm({
      enabled: settings.reviewWindow!.enabled,
      hoursAfterClose: settings.reviewWindow!.hoursAfterClose,
      penaltyPerEntry: settings.reviewWindow!.penaltyPerEntry,
      autoApprove: settings.reviewWindow!.autoApprove ?? false,
      schedule: settings.reviewWindow!.schedule ?? { openDay: 'tuesday', openTime: '16:00', closeDay: 'wednesday', closeTime: '16:00' },
    })
  }, [settings?.reviewWindow])

  const saveAllSettings = (updates: Partial<AppSettings>) => {
    const newData = { ...settings, ...updates } as AppSettings
    saveSettings(newData)
    logAudit('settings_change', 'system', { updates: Object.keys(updates) })
    toast.success('Settings updated')
  }

  const titleCaseDay = (day: string) => day.charAt(0).toUpperCase() + day.slice(1)
  const dayOptions = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

  const downloadBackup = () => {
    const payload = { staff, entries, settings, leaves, publicHolidays }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dsn-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    logAudit('backup_downloaded', 'system', { staff: staff.length, entries: entries.length })
  }

  const recalcAllPoints = async () => {
    try {
      // Server reconciles atomically: staff.points = floored sum of points_history,
      // current_week_points = sum for the current week. Then pull fresh staff.
      const res = await fetch('/api/points-history/recalc', { method: 'POST' })
      if (!res.ok) throw new Error('recalc failed')
      const fresh: any[] = await (await fetch('/api/staff')).json()
      if (Array.isArray(fresh) && fresh.length) saveStaff(fresh)
      logAudit('points_recalculated', 'system', { staffCount: fresh.length })
      toast.success('Points recalculated')
    } catch {
      toast.error('Failed to recalculate points')
    }
  }

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
          <div className="flex flex-col gap-6">
            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--gold-tint)', 'var(--gold)')}><Target size={17} /></span>
                <div style={cardTitle}>Points &amp; Awards Configuration</div>
              </div>
              <div style={cardBody}>
                <div style={subHead}>Submission Points</div>
                <div style={subDesc}>Points awarded when staff submit their weekly timesheet.</div>
                <div style={rubricLine}>
                  Rubric: Early ({pointsForm.earlySubmissionHours}h from window open) → On-time → Outside window penalty
                </div>
                <div style={{ ...grid2, marginTop: 18 }}>
                  {([
                    { key: 'earlySubmission', label: 'Early Submission', hint: `Within first ${pointsForm.earlySubmissionHours}h of window opening` },
                    { key: 'earlySubmissionHours', label: 'Early Window (hours)', hint: 'Hours from window open that count as early' },
                    { key: 'onTimeSubmission', label: 'On-Time Submission', hint: 'Within submission window (after early cutoff)' },
                    { key: 'outsideWindowPenalty', label: 'Outside Window Penalty', hint: 'Submitted after the window closes / outside any window', danger: true },
                  ] as { key: keyof typeof pointsForm, label: string, hint: string, danger?: boolean }[]).map(({ key, label, hint, danger }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input type="number" style={inputStyle({ mono: true, danger: danger || Number(pointsForm[key]) < 0 })} value={pointsForm[key]}
                        onChange={e => setPointsForm({ ...pointsForm, [key]: Number(e.target.value) })} />
                      <div style={helperStyle}>{hint}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--tint)', 'var(--brand)')}><Flame size={17} /></span>
                <div style={cardTitle}>Streaks &amp; Bonuses</div>
              </div>
              <div style={cardBody}>
                <div style={grid3}>
                  {([
                    { key: 'fullWeekBonus', label: 'Full 40h Week Bonus', hint: 'Awarded for a complete logged week' },
                    { key: 'streakBonus', label: 'Streak Bonus (per week)', hint: 'Consecutive on-time weeks' },
                    { key: 'approvalBonus', label: 'Approval Bonus', hint: 'Each timesheet approved without edits' },
                  ] as { key: keyof typeof pointsForm, label: string, hint: string }[]).map(({ key, label, hint }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input type="number" style={inputStyle({ mono: true })} value={pointsForm[key]}
                        onChange={e => setPointsForm({ ...pointsForm, [key]: Number(e.target.value) })} />
                      <div style={helperStyle}>{hint}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={saveFooter}>
                <button style={discardBtn} onClick={() => setPointsForm({
                  earlySubmission: settings?.pointsConfig?.earlySubmission ?? 3,
                  onTimeSubmission: settings?.pointsConfig?.onTimeSubmission ?? 2,
                  outsideWindowPenalty: settings?.pointsConfig?.outsideWindowPenalty ?? -1,
                  earlySubmissionHours: settings?.pointsConfig?.earlySubmissionHours ?? 4,
                  fullWeekBonus: settings?.pointsConfig?.fullWeekBonus ?? 50,
                  streakBonus: settings?.pointsConfig?.streakBonus ?? 25,
                  approvalBonus: settings?.pointsConfig?.approvalBonus ?? 5,
                })}>Discard</button>
                <button style={saveBtn} onClick={() => saveAllSettings({ pointsConfig: pointsForm })}>
                  <Save size={15} /> Save changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HOUR CAPS */}
        {tab === 'caps' && (
          <div style={cardShell}>
            <div style={cardHead}>
              <span style={iconTile('var(--info-tint)', 'var(--info)')}><BarChart3 size={17} /></span>
              <div style={cardTitle}>Hour &amp; Point Caps</div>
            </div>
            <div style={cardBody}>
              <div style={{ ...subDesc, marginTop: 0, marginBottom: 18 }}>Guardrails that keep entries and rewards within policy.</div>
              <div style={grid3}>
                {([
                  { key: 'maxHoursPerDay', label: 'Max Hours / Day', hint: 'Largest single-day entry allowed' },
                  { key: 'maxHoursPerWeek', label: 'Max Hours / Week', hint: 'Cap on total weekly logged hours' },
                  { key: 'minHoursPerWeek', label: 'Min Hours / Week', hint: 'Below this is flagged as under-target', color: 'info' },
                  { key: 'weeklyPointsCap', label: 'Weekly Points Cap', hint: 'Maximum points earnable in one week', color: 'brand' },
                  { key: 'dailyEntryLimit', label: 'Daily Entry Limit', hint: 'Max separate entries per day' },
                  { key: 'backdatingLimitDays', label: 'Backdating Limit (days)', hint: 'How far back staff may log', color: 'danger' },
                ] as { key: keyof typeof capsForm, label: string, hint: string, color?: 'info' | 'brand' | 'danger' }[]).map(({ key, label, hint, color }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      type="number"
                      style={{
                        ...inputStyle({ mono: true, danger: color === 'danger' }),
                        ...(color === 'info' ? { color: 'var(--info)' } : {}),
                        ...(color === 'brand' ? { color: 'var(--brand)' } : {}),
                      }}
                      value={capsForm[key] as number}
                      onChange={e => setCapsForm({ ...capsForm, [key]: Number(e.target.value) })}
                    />
                    <div style={helperStyle}>{hint}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={saveFooter}>
              <button style={discardBtn} onClick={() => setCapsForm({
                defaultStaffCap: settings?.hourCaps?.defaultStaffCap ?? 40,
                internCap: settings?.hourCaps?.internCap ?? 32,
                cdsVisibility: settings?.hourCaps?.cdsVisibility ?? true,
                customCaps: settings?.hourCaps?.customCaps ?? [],
                deadlineOverride: settings?.hourCaps?.deadlineOverride ?? null,
                maxHoursPerDay: settings?.hourCaps?.maxHoursPerDay ?? 12,
                maxHoursPerWeek: settings?.hourCaps?.maxHoursPerWeek ?? 60,
                minHoursPerWeek: settings?.hourCaps?.minHoursPerWeek ?? 35,
                weeklyPointsCap: settings?.hourCaps?.weeklyPointsCap ?? 200,
                dailyEntryLimit: settings?.hourCaps?.dailyEntryLimit ?? 8,
                backdatingLimitDays: settings?.hourCaps?.backdatingLimitDays ?? 14,
              })}>Discard</button>
              <button style={saveBtn} onClick={() => saveAllSettings({ hourCaps: capsForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* SUBMISSION WINDOW */}
        {tab === 'submission' && (
          <div className="flex flex-col gap-6">
            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--tint)', 'var(--brand)')}><Clock size={17} /></span>
                <div style={cardTitle}>Submission Window</div>
              </div>
              <div style={cardBody}>
                <div style={{ ...subDesc, marginTop: 0, marginBottom: 18 }}>When staff can log and submit hours each week.</div>
                <div style={grid2}>
                  <div>
                    <label style={labelStyle}>Opens — Day</label>
                    <select style={inputStyle()} value={submissionWindowForm.schedule.startDay}
                      onChange={e => setSubmissionWindowForm({ ...submissionWindowForm, schedule: { ...submissionWindowForm.schedule, startDay: e.target.value as any } })}>
                      {dayOptions.map(d => <option key={d} value={d}>{titleCaseDay(d)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Opens — Time</label>
                    <input type="time" style={inputStyle({ mono: true })} value={submissionWindowForm.schedule.startTime}
                      onChange={e => setSubmissionWindowForm({ ...submissionWindowForm, schedule: { ...submissionWindowForm.schedule, startTime: e.target.value } })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Closes — Day</label>
                    <select style={inputStyle()} value={submissionWindowForm.schedule.endDay}
                      onChange={e => setSubmissionWindowForm({ ...submissionWindowForm, schedule: { ...submissionWindowForm.schedule, endDay: e.target.value as any } })}>
                      {dayOptions.map(d => <option key={d} value={d}>{titleCaseDay(d)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Closes — Time</label>
                    <input type="time" style={inputStyle({ mono: true })} value={submissionWindowForm.schedule.endTime}
                      onChange={e => setSubmissionWindowForm({ ...submissionWindowForm, schedule: { ...submissionWindowForm.schedule, endTime: e.target.value } })} />
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <ToggleRow
                    title="Auto-open each week"
                    desc="Window opens automatically on the schedule above"
                    on={submissionWindowForm.enabled}
                    onClick={() => setSubmissionWindowForm({ ...submissionWindowForm, enabled: !submissionWindowForm.enabled })}
                  />
                </div>
              </div>
            </div>

            <div style={saveFooter}>
              <button style={discardBtn} onClick={() => settings?.submissionWindow && setSubmissionWindowForm({ gracePeriodHours: 6, ...settings.submissionWindow })}>Discard</button>
              <button style={saveBtn} onClick={() => saveAllSettings({ submissionWindow: submissionWindowForm })}>
                <Save size={15} /> Save changes
              </button>
            </div>
          </div>
        )}

        {/* REVIEW WINDOW */}
        {tab === 'review' && (
          <div className="flex flex-col gap-6">
            {/* Review Window */}
            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--violet-tint)', 'var(--violet)')}><CheckSquare size={17} /></span>
                <div style={cardTitle}>Review Window</div>
              </div>
              <div style={cardBody}>
                <div style={{ ...subDesc, marginTop: 0, marginBottom: 18 }}>When team leads review and approve submitted hours.</div>
                <div style={grid2}>
                  <div>
                    <label style={labelStyle}>Review Opens — Day</label>
                    <select style={inputStyle()} value={reviewWindowForm.schedule.openDay}
                      onChange={e => setReviewWindowForm({ ...reviewWindowForm, schedule: { ...reviewWindowForm.schedule, openDay: e.target.value } })}>
                      {dayOptions.map(d => <option key={d} value={d}>{titleCaseDay(d)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Review Opens — Time</label>
                    <input type="time" style={inputStyle({ mono: true })} value={reviewWindowForm.schedule.openTime}
                      onChange={e => setReviewWindowForm({ ...reviewWindowForm, schedule: { ...reviewWindowForm.schedule, openTime: e.target.value } })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Review Closes — Day</label>
                    <select style={inputStyle()} value={reviewWindowForm.schedule.closeDay}
                      onChange={e => setReviewWindowForm({ ...reviewWindowForm, schedule: { ...reviewWindowForm.schedule, closeDay: e.target.value } })}>
                      {dayOptions.map(d => <option key={d} value={d}>{titleCaseDay(d)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Review Closes — Time</label>
                    <input type="time" style={inputStyle({ mono: true })} value={reviewWindowForm.schedule.closeTime}
                      onChange={e => setReviewWindowForm({ ...reviewWindowForm, schedule: { ...reviewWindowForm.schedule, closeTime: e.target.value } })} />
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <ToggleRow
                    title="Auto-approve unreviewed hours"
                    desc="If a lead doesn't act before the review window closes"
                    on={!!reviewWindowForm.autoApprove}
                    onClick={() => setReviewWindowForm({ ...reviewWindowForm, autoApprove: !reviewWindowForm.autoApprove })}
                  />
                </div>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={discardBtn} onClick={() => settings?.reviewWindow && setReviewWindowForm({
                enabled: settings.reviewWindow.enabled,
                hoursAfterClose: settings.reviewWindow.hoursAfterClose,
                penaltyPerEntry: settings.reviewWindow.penaltyPerEntry,
                autoApprove: settings.reviewWindow.autoApprove ?? false,
                schedule: settings.reviewWindow.schedule ?? { openDay: 'tuesday', openTime: '16:00', closeDay: 'wednesday', closeTime: '16:00' },
              })}>Discard</button>
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
            <div style={{ ...cardHead, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={iconTile('var(--warn-tint)', 'var(--danger)')}><CalendarDays size={17} /></span>
                <div style={cardTitle}>Public &amp; Internal Holidays</div>
              </div>
              <button style={{ ...saveBtn, boxShadow: 'none' }} onClick={() => setShowHolidayForm(v => !v)}>
                <Plus size={15} /> Add holiday
              </button>
            </div>
            <div style={cardBody}>
              {showHolidayForm && (
                <div style={{ ...grid3, marginBottom: 18, alignItems: 'end', padding: 16, background: 'var(--canvas)', borderRadius: 'var(--r-sm)' }}>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input type="text" style={inputStyle()} placeholder="Holiday name" value={holidayDraft.name}
                      onChange={e => setHolidayDraft({ ...holidayDraft, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input type="date" style={inputStyle()} value={holidayDraft.date}
                      onChange={e => setHolidayDraft({ ...holidayDraft, date: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Type</label>
                      <select style={inputStyle()} value={holidayDraft.type}
                        onChange={e => setHolidayDraft({ ...holidayDraft, type: e.target.value as 'public' | 'internal' })}>
                        <option value="public">Public</option>
                        <option value="internal">Internal</option>
                      </select>
                    </div>
                    <button
                      style={saveBtn}
                      onClick={() => {
                        if (!holidayDraft.name || !holidayDraft.date) return
                        setHolidayConfirm({
                          isOpen: true,
                          title: 'Add Holiday',
                          message: `Add "${holidayDraft.name}" on ${new Date(holidayDraft.date).toLocaleDateString()}?`,
                          action: () => {
                            const newHoliday: PublicHoliday = {
                              id: genId(),
                              name: holidayDraft.name,
                              date: holidayDraft.date,
                              capReduction: 8,
                              type: holidayDraft.type,
                            }
                            savePublicHolidays([...publicHolidays, newHoliday])
                            logAudit('holiday_added', newHoliday.id, { name: newHoliday.name, date: newHoliday.date, type: newHoliday.type })
                            setHolidayDraft({ name: '', date: '', type: 'public' })
                            setShowHolidayForm(false)
                            toast.success('Holiday added')
                          }
                        })
                      }}
                    ><Plus size={15} /> Add</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {publicHolidays.map(h => {
                  const isInternal = h.type === 'internal'
                  return (
                    <div key={h.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderBottom: '1px solid var(--line-2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--canvas)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <span style={iconTile('var(--elev)', 'var(--ink-3)')}><CalendarDays size={15} /></span>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{h.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>{fmtDate(h.date)}</div>
                        <div style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: isInternal ? 'var(--violet-tint)' : 'var(--tint)',
                          color: isInternal ? 'var(--violet)' : 'var(--brand-2)',
                        }}>{isInternal ? 'Internal' : 'Public'}</div>
                        <button
                          style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
                          onClick={() => setHolidayConfirm({
                            isOpen: true,
                            title: 'Delete Holiday',
                            message: `Delete "${h.name}"? This cannot be undone.`,
                            action: () => {
                              savePublicHolidays(publicHolidays.filter(x => x.id !== h.id))
                              logAudit('holiday_deleted', h.id, { name: h.name, date: h.date })
                              toast.success('Holiday deleted')
                            }
                          })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}






        {/* SECURITY & PASSWORDS */}
        {tab === 'security' && (
          <div className="flex flex-col gap-6">
            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--danger-tint)', 'var(--danger)')}><Shield size={17} /></span>
                <div style={cardTitle}>Access &amp; Authentication</div>
              </div>
              <div style={cardBody}>
                <ToggleRow
                  title="Auto-logout idle sessions"
                  desc="Sign out after the timeout below"
                  on={!!securityForm.autoLogoutIdle}
                  onClick={() => setSecurityForm({ ...securityForm, autoLogoutIdle: !securityForm.autoLogoutIdle })}
                />
                <div style={{ ...grid3, marginTop: 18 }}>
                  <div>
                    <label style={labelStyle}>Min password length</label>
                    <input type="number" style={inputStyle({ mono: true })} value={securityForm.minPasswordLength}
                      onChange={e => setSecurityForm({ ...securityForm, minPasswordLength: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Password expiry (days)</label>
                    <input type="number" style={inputStyle({ mono: true })} value={securityForm.passwordExpiryDays}
                      onChange={e => setSecurityForm({ ...securityForm, passwordExpiryDays: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Session timeout (min)</label>
                    <input type="number" style={inputStyle({ mono: true })} value={securityForm.sessionTimeoutMin}
                      onChange={e => setSecurityForm({ ...securityForm, sessionTimeoutMin: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
              <div style={saveFooter}>
                <button style={discardBtn} onClick={() => setSecurityForm({
                  defaultPassword: settings?.security?.defaultPassword ?? 'dsn-staff',
                  requireTwoFactor: settings?.security?.requireTwoFactor ?? false,
                  autoLogoutIdle: settings?.security?.autoLogoutIdle ?? true,
                  minPasswordLength: settings?.security?.minPasswordLength ?? 8,
                  passwordExpiryDays: settings?.security?.passwordExpiryDays ?? 90,
                  sessionTimeoutMin: settings?.security?.sessionTimeoutMin ?? 30,
                })}>Discard</button>
                <button style={saveBtn} onClick={() => saveAllSettings({ security: securityForm })}>
                  <Save size={15} /> Update settings
                </button>
              </div>
            </div>

            {/* Pending password resets */}
            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--warn-tint)', 'var(--warn)')}><Lock size={17} /></span>
                <div style={cardTitle}>Pending password resets</div>
              </div>
              <div style={cardBody}>
                {(passwordResetRequests || []).filter(r => r.status === 'pending').length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '12px 0', textAlign: 'center' }}>No pending password resets.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(passwordResetRequests || []).filter(r => r.status === 'pending').map(req => {
                      const member = staff.find(s => s.id === req.staffId)
                      const name = member?.name || 'Unknown Staff'
                      const email = member?.email || ''
                      const resetPw = securityForm.defaultPassword || 'dsn-staff'
                      return (
                        <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderBottom: '1px solid var(--line-2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <span style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(name), color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(name)}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{name}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{timeAgo(req.requestedAt)}</div>
                            <button
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'var(--tint)', color: 'var(--brand-2)', fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                              onClick={async () => {
                                try {
                                  await fetch(`/api/staff/${req.staffId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ password: resetPw, first_login: true, password_reset_pending: true, force_logout: true }),
                                  })
                                } catch {}
                                saveStaff(staff.map(s => s.id === req.staffId ? { ...s, password: resetPw, first_login: true, password_reset_pending: true } : s))
                                savePasswordResetRequests((passwordResetRequests || []).filter(r => r.id !== req.id))
                                notify(req.staffId, `Your password has been reset by Admin. Please change it on next login.`, 'info')
                                logAudit('password_reset_approved', req.staffId, { name })
                                toast.success('Password reset')
                              }}
                            ><Check size={14} /> Reset</button>
                            <button
                              style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6 }}
                              onClick={() => { savePasswordResetRequests((passwordResetRequests || []).filter(r => r.id !== req.id)); logAudit('password_reset_declined', req.staffId, { name }) }}
                            ><X size={16} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DATABASE */}
        {tab === 'database' && (
          <div className="flex flex-col gap-6">
            {/* Last backup */}
            <div style={cardShell}>
              <div style={cardBody}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={iconTile('var(--info-tint)', 'var(--info)')}><Database size={17} /></span>
                    <div>
                      <div style={cardTitle}>Last backup</div>
                      <div style={{ ...subDesc, fontFamily: 'var(--mono)' }}>{lastBackup}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      style={{ ...discardBtn, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface)' }}
                      onClick={downloadBackup}
                    ><Download size={15} /> Download</button>
                    <button
                      style={saveBtn}
                      onClick={() => {
                        const stamp = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        setLastBackup(`Today at ${stamp} WAT · manual`)
                        toast.success('Backup created')
                      }}
                    ><Database size={15} /> Back up now</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Export data */}
            <div style={cardShell}>
              <div style={cardHead}>
                <span style={iconTile('var(--tint)', 'var(--brand)')}><FileText size={17} /></span>
                <div style={cardTitle}>Export data</div>
              </div>
              <div style={cardBody}>
                <div style={grid3}>
                  {([
                    {
                      icon: <FileText size={18} />, title: 'Timesheets', sub: 'All weeks · CSV',
                      onClick: () => exportCSV(entries.map(e => ({
                        staff: e.staffName, weekKey: e.weekKey, date: e.startDate, project: e.project,
                        category: e.category, description: e.description, hours: e.hours, status: e.status,
                      })), 'timesheets.csv')
                    },
                    {
                      icon: <Users size={18} />, title: 'Staff records', sub: 'Roster · CSV',
                      onClick: () => exportCSV(staff.map(s => ({
                        name: s.name, email: s.email, role: s.role, department: s.department,
                        jobTitle: s.jobTitle || '', status: s.status, points: s.points ?? 0,
                      })), 'staff.csv')
                    },
                    {
                      icon: <BarChart size={18} />, title: 'Points ledger', sub: 'Full history · CSV',
                      onClick: async () => {
                        try {
                          const res = await fetch('/api/points-history')
                          const history: any[] = await res.json()
                          if (!history.length) { toast.error('No points history to export'); return }
                          exportCSV(history.map(h => ({
                            staffId: h.staffId ?? '', weekId: h.weekId, action: h.action,
                            points: h.points, timestamp: h.timestamp,
                          })), 'points-ledger.csv')
                        } catch { toast.error('Failed to export points ledger') }
                      }
                    },
                  ]).map(card => (
                    <div key={card.title} onClick={card.onClick}
                      style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: 18, cursor: 'pointer', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sh-sm)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <span style={iconTile('var(--tint)', 'var(--brand)')}>{card.icon}</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{card.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{card.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div style={{ ...cardShell, border: '1px solid var(--danger)', background: 'var(--danger-tint)' }}>
              <div style={cardHead}>
                <span style={iconTile('var(--danger-tint)', 'var(--danger)')}><AlertTriangle size={17} /></span>
                <div style={cardTitle}>Danger zone</div>
              </div>
              <div style={cardBody}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 16, lineHeight: 1.5 }}>
                  Recalculating all points re-runs the scoring engine across every submitted week. This can take several minutes and cannot be undone.
                </div>
                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', border: '1px solid var(--danger)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setRecalcConfirm(true)}
                ><AlertTriangle size={15} /> Recalculate all points</button>
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
      <ConfirmModal
        isOpen={recalcConfirm}
        title="Recalculate all points"
        message="This re-runs the scoring engine across every submitted week and overwrites all staff point totals. This cannot be undone. Continue?"
        onConfirm={() => { setRecalcConfirm(false); recalcAllPoints() }}
        onCancel={() => setRecalcConfirm(false)}
      />
    </div>
  )
}
