'use client'
import React, { useState } from 'react'
import BulkTimeEntryImport from './BulkTimeEntryImport'
import { useApp } from '../../context/AppContext'
import { local, exportCSV, genId } from '../../lib/utils'
import { AppSettings, WeekLock, PublicHoliday } from '../../types'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { 
    settings, saveSettings, user, logAudit, 
    announcements, saveAnnouncements,
    weekLocks, saveWeekLocks,
    auditLogs, saveAuditLogs,
    publicHolidays, savePublicHolidays,
    projects, saveProjects,
    entries, saveEntries,
    passwordResetRequests, savePasswordResetRequests,
    staff, saveStaff, notify
  } = useApp()

  const [tab, setTab] = useState<string>('branding')
  const [testingConnection, setTestingConnection] = useState(false)
  
  // Local form state
  const [fbForm, setFbForm] = useState(settings?.firebase || { url: '', anonKey: '', isConnected: false })
  const [brandForm, setBrandForm] = useState(settings?.branding || { appName: 'DSN Timesheet', welcomeMessage: 'Welcome', primaryColour: '#4F46E5', secondaryColour: '#10B981', logoBase64: null })
  const [pointsForm, setPointsForm] = useState(settings?.pointsConfig || { onTimeSubmission: 10, mondayBonus: 5, earlyBonus: 5, approvedEntry: 10, approvedWithNote: 5, perfectWeek: 20, hoursBonus: 1, streakBonus: 15, rejectionDeduction: -5 })
  const [capsForm, setCapsForm] = useState(settings?.hourCaps || { defaultStaffCap: 40, internCap: 32, cdsVisibility: true, customCaps: [] })
  const [toggles, setToggles] = useState(settings?.featureToggles || { gamification: true, leaderboard: true, messaging: true, bulkImports: true, darkMode: true, twoFactorAdminsLeads: true, deadlineCountdown: true, firstLoginWalkthrough: true, approvalDelegation: true, pdfExport: true, profilePhotos: true, streakRecovery: true, duplicateDetection: true, announcements: true, orgChart: true })
  const [securityForm, setSecurityForm] = useState(settings?.security || { defaultPassword: 'dsn-staff', requireTwoFactor: false })
  
  const tabs = [

    { id: 'branding', label: '🎨 Branding', icon: '✨' },
    { id: 'toggles', label: '🎛️ Toggles', icon: '⚙️' },
    { id: 'points', label: '🏆 Points', icon: '🎯' },
    { id: 'caps', label: '🕒 Caps', icon: '⏳' },
    { id: 'weeks', label: '🔐 Weeks', icon: '📅' },
    { id: 'holidays', label: '🏖️ Holidays', icon: '🗓️' },
    { id: 'projects', label: '📁 Projects', icon: '💼' },
    { id: 'queue', label: '🔑 Resets', icon: '🛡️' },
    { id: 'thresholds', label: '📊 Limits', icon: '📈' },
    { id: 'bulk_projects', label: '📁 Bulk Projects', icon: '📦' },
    { id: 'logs', label: '📜 Audit', icon: '🕵️' },
    { id: 'security', label: '🛡️ Security', icon: '🔒' },
    { id: 'deleted', label: '🗑️ Deleted', icon: '♻️' },
  ]

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">⚙️ System Settings</h1>
        <p className="text-sm text-4">Platform configuration and administrative control</p>
      </div>

      <div className="flex gap-2 p-1 bg-2 rounded-lg overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-primary text-white shadow-sm' : 'hover:bg-3 text-2'
            }`}
          >
            <span>{t.icon}</span>
            <span className="text-xs font-medium">{t.label}</span>
          </button>
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

        {/* FEATURE TOGGLES */}
        {tab === 'toggles' && (
          <div className="card flex flex-col gap-4">
            <h3 className="font-bold">🎛️ Feature Toggles</h3>
            <p className="text-xs text-3 mb-2">Enable or disable specific modules across the platform.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(toggles).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-2 rounded-lg border border-3">
                  <span className="text-xs font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                   <button
                    onClick={() => {
                      const next = { ...toggles, [key]: !value }
                      setToggles(next)
                      saveAllSettings({ featureToggles: next })
                    }}
                    className={`w-10 h-5 rounded-full relative transition-all ${value ? 'bg-success' : 'bg-3'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${value ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          <div className="mt-4 p-4 bg-soft-primary rounded-lg text-xs text-primary">
            ℹ️ Changes to feature toggles will take effect immediately for all users.
          </div>
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

        {/* WEEK LOCKING */}
        {tab === 'weeks' && (
          <div className="card flex flex-col gap-4">
            <h3 className="font-bold">🔐 Week Locking</h3>
            <p className="text-xs text-3">Locking a week prevents all staff from adding or submitting entries.</p>
            <div className="flex gap-2 p-4 bg-2 rounded-lg border border-3 mb-2">
               <input type="date" className="form-input text-xs" id="lock-date-input" />
               <button 
                className="btn btn-danger btn-sm whitespace-nowrap"
                onClick={() => {
                  const date = (document.getElementById('lock-date-input') as HTMLInputElement).value
                  if (!date) return
                  const weekId = date // Simplify for now or format to YYYY-WXX
                  const newLock: WeekLock = {
                    id: genId(),
                    weekId,
                    isLocked: true,
                    lockedBy: user?.name || 'Admin',
                    lockedAt: new Date().toISOString()
                  }
                  saveWeekLocks([...weekLocks, newLock])
                  logAudit('settings_change', weekId, { action: 'lock_week' })
                  toast.success(`Week ${weekId} locked`)
                }}
               >Lock Week</button>
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

        {/* PROJECTS & CATEGORIES */}
        {tab === 'projects' && (
          <div className="grid gap-6">
            <div className="card flex flex-col gap-4">
              <h3 className="font-bold">📁 Projects Management</h3>
              <div className="flex gap-2">
                <input type="text" className="form-input text-xs" id="project-name" placeholder="New Project Name" />
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const name = (document.getElementById('project-name') as HTMLInputElement).value
                    if (!name) return
                    saveProjects([...projects, { id: genId(), name, active: true, budget: 0 }])
                    toast.success('Project added')
                  }}
                >Add</button>
              </div>
              <div className="grid gap-2 mt-2">
                {projects.map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border border-3 ${p.active ? 'bg-2' : 'bg-3 opacity-60'}`}>
                    <div className="text-xs font-medium">{p.name} {!p.active && '(Retired)'}</div>
                    <div className="flex gap-2">
                      <button 
                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${p.active ? 'bg-soft-warning text-warning' : 'bg-soft-success text-success'}`}
                        onClick={() => {
                          saveProjects(projects.map(x => x.id === p.id ? { ...x, active: !x.active } : x))
                        }}
                      >
                        {p.active ? 'Retire' : 'Restore'}
                      </button>
                      <button 
                        className="btn btn-icon text-danger p-1"
                        onClick={() => saveProjects(projects.filter(x => x.id !== p.id))}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card flex flex-col gap-4">
              <h3 className="font-bold">🏷️ Entry Categories</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings?.categories.map(c => (
                  <div key={c} className="flex items-center gap-2 px-3 py-1.5 bg-soft-primary text-primary rounded-full text-xs font-medium">
                    {c}
                    <button className="hover:text-danger" onClick={() => {
                      const next = settings.categories.filter(x => x !== c)
                      saveAllSettings({ categories: next })
                    }}>×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" className="form-input text-xs" id="cat-name" placeholder="New Category" />
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const name = (document.getElementById('cat-name') as HTMLInputElement).value
                    if (!name) return
                    saveAllSettings({ categories: [...settings.categories, name] })
                  }}
                >Add</button>
              </div>
            </div>
          </div>
        )}

        {/* PASSWORD RESET QUEUE */}
        {tab === 'queue' && (
          <div className="card flex flex-col gap-4">
            <h3 className="font-bold underline decoration-primary decoration-2 underline-offset-4">🛡️ Password Reset Queue</h3>
            <p className="text-xs text-3">Review and approve password reset requests from staff.</p>
            <div className="grid gap-3">
              {passwordResetRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 bg-2 rounded-xl border border-dashed border-3">
                  <span className="text-3xl">🛡️</span>
                  <p className="text-xs text-4 font-medium">No pending reset requests</p>
                </div>
              ) : (
                passwordResetRequests.filter(r => r.status === 'pending').map(req => {
                   const staffMember = staff.find(s => s.id === req.staffId)
                   return (
                    <div key={req.id} className="flex items-center justify-between p-4 bg-2 rounded-xl border border-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-soft-warning flex items-center justify-center text-warning text-lg">🔑</div>
                        <div>
                          <div className="text-sm font-bold">{staffMember?.name || 'Unknown Staff'}</div>
                          <div className="text-[10px] text-3">Requested on {new Date(req.requestedAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button 
                          className="btn btn-success btn-sm"
                          onClick={() => {
                            // Reset password to dsn-staff
                            const updatedStaff = staff.map(s => s.id === req.staffId ? { ...s, password: 'dsn-staff', mustChangePassword: true, first_login: true } : s)
                            saveStaff(updatedStaff)
                            const updatedReqs = passwordResetRequests.map(r => r.id === req.id ? { ...r, status: 'resolved' as const, resolvedBy: user?.name, resolvedAt: new Date().toISOString() } : r)
                            savePasswordResetRequests(updatedReqs)
                            logAudit('password_reset', req.staffId, { action: 'admin_reset_approved' })
                            notify(req.staffId, 'Your password reset request has been approved. Your temporary password is "dsn-staff".', 'password_reset', 'Password Reset Approved', req.id, 'message')
                            toast.success('Password reset to dsn-staff')
                          }}
                         >Approve Reset</button>
                         <button 
                          className="btn btn-danger-outline btn-sm"
                          onClick={() => {
                            savePasswordResetRequests(passwordResetRequests.filter(r => r.id !== req.id))
                            toast.success('Request declined')
                          }}
                         >Decline</button>
                      </div>
                    </div>
                   )
                })
              )}
            </div>
          </div>
        )}

        {/* THRESHOLDS */}
        {tab === 'thresholds' && (
          <div className="card flex flex-col gap-6">
            <h3 className="font-bold">📈 Analytics Thresholds</h3>
            <p className="text-xs text-3">Set hour limits to highlight staff with high or low workload in analytics.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Low Workload Threshold (hrs/week)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    className="form-input" 
                    value={settings?.utilizationThresholds?.low || 25} 
                    onChange={e => saveAllSettings({ utilizationThresholds: { ...settings?.utilizationThresholds, low: Number(e.target.value), high: settings?.utilizationThresholds?.high || 40 } })}
                  />
                  <span className="text-xs text-4">e.g. 25h</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">High Workload Threshold (hrs/week)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    className="form-input" 
                    value={settings?.utilizationThresholds?.high || 40} 
                    onChange={e => saveAllSettings({ utilizationThresholds: { ...settings?.utilizationThresholds, high: Number(e.target.value), low: settings?.utilizationThresholds?.low || 25 } })}
                  />
                  <span className="text-xs text-4">e.g. 40h</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-soft-warning rounded-lg border border-warning-subtle text-xs text-warning">
              <strong>Tip:</strong> These values are used in the "Utilisation" tab of the Analytics page to flag staff with red/yellow indicators.
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
            
            <div className="divider"></div>
            
            <div className="p-4 bg-soft-danger rounded-lg border border-danger-subtle">
              <h4 className="text-xs font-bold text-danger mb-2">🚨 Critical Action: Bulk Password Update</h4>
              <p className="text-[10px] text-danger-subtle mb-3">Resets EVERY user's password to the default set above. Users will be forced to change it on next login.</p>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm('Are you absolutely sure? This will logout all users and reset their passwords.')) {
                    const next = staff.map(s => ({ ...s, password: securityForm.defaultPassword || 'dsn-staff', mustChangePassword: true, first_login: true, forceLogout: true }))
                    saveStaff(next)
                    logAudit('bulk_password_reset', 'system', { defaultPass: securityForm.defaultPassword })
                    toast.success('All passwords reset successfully')
                  }
                }}
              >Reset All User Passwords</button>
            </div>
          </div>
        )}

        {/* BULK PROJECT IMPORT */}
        {tab === 'bulk_projects' && (
          <div className="card flex flex-col gap-6">
            <h3 className="font-bold">📦 Bulk Project Import</h3>
            <p className="text-xs text-3">Import multiple projects at once using a CSV file.</p>
            <div className="flex flex-col gap-4 p-8 bg-2 rounded-xl border border-dashed border-3 text-center">
              <div className="text-3xl">📄</div>
              <div>
                <button className="btn btn-primary btn-sm mb-2" onClick={() => {
                   const input = document.createElement('input')
                   input.type = 'file'
                   input.accept = '.csv'
                   input.onchange = (e: any) => {
                     const file = e.target.files[0]
                     if (!file) return
                     const reader = new FileReader()
                     reader.onload = (evt) => {
                       const text = evt.target?.result as string
                       const rows = text.split('\n').slice(1).filter(r => r.trim())
                       const newProjects = rows.map(r => ({ id: genId(), name: r.trim(), active: true, budget: 0 }))
                       saveProjects([...projects, ...newProjects])
                       toast.success(`Imported ${newProjects.length} projects`)
                     }
                     reader.readAsText(file)
                   }
                   input.click()
                }}>Upload Projects CSV</button>
                <p className="text-[10px] text-4">CSV should have one project name per line (with header).</p>
              </div>
              <button className="text-xs text-accent underline cursor-pointer" onClick={() => exportCSV([{ ProjectName: 'Project X' }, { ProjectName: 'Project Y' }], 'projects_template.csv')}>
                Download Template
              </button>
            </div>
          </div>
        )}

        {/* AUDIT LOGS */}
        {tab === 'logs' && (
          <div className="card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">📜 System Audit Log</h3>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const data = auditLogs.map(l => ({
                    Time: l.timestamp,
                    User: l.performedBy,
                    Action: l.action,
                    Target: l.targetId,
                    Device: l.device,
                    IP: l.ipAddress
                  }))
                  exportCSV(data, `audit_log_${new Date().toISOString().slice(0,10)}.csv`)
                }}
              >Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-2 text-3 font-bold">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">IP / Location</th>
                    <th className="p-3">Device / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-3">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-2 transition-colors">
                      <td className="p-3 whitespace-nowrap text-3 font-mono">{new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="p-3 font-bold">{log.performedBy}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ['rejected', 'delete', 'force_logout'].includes(log.action) ? 'bg-soft-danger text-danger' :
                          ['approve', 'restore'].includes(log.action) ? 'bg-soft-success text-success' : 'bg-soft-primary text-primary'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-3 truncate max-w-[120px]">{log.targetId}</td>
                      <td className="p-3 text-3 font-mono">{log.ipAddress || '—'}</td>
                      <td className="p-3 text-3 truncate max-w-[200px]" title={log.device}>{log.device || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DELETED ENTRIES */}
        {tab === 'deleted' && (
          <div className="card flex flex-col gap-4">
            <h3 className="font-bold">🗑️ Soft Deleted Entries</h3>
            <p className="text-xs text-3">Entries deleted within the last 30 days can be restored here.</p>
            <div className="grid gap-3">
              {entries.filter(e => e.deleted).length === 0 ? (
                <div className="py-12 text-center text-4 text-xs italic">No recently deleted entries.</div>
              ) : (
                entries.filter(e => e.deleted).map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-4 bg-2 rounded-xl border border-3">
                    <div>
                      <div className="text-sm font-bold">{entry.project} — {entry.staffName}</div>
                      <div className="text-[10px] text-3">{entry.hours}h · {entry.date} · Deleted on {new Date(entry.deletedAt || '').toLocaleDateString()}</div>
                    </div>
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        saveEntries(entries.map(e => e.id === entry.id ? { ...e, deleted: false, deletedAt: undefined } : e))
                        logAudit('restore', entry.id, { action: 'entry_restore' })
                        toast.success('Entry restored to draft status')
                      }}
                    >Restore</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
