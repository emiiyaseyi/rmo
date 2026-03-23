'use client'
import React, { useState } from 'react'
import BulkTimeEntryImport from './BulkTimeEntryImport'
import { useApp } from '../../context/AppContext'
import { local, exportCSV, genId, fmtDate, DEFAULT_POINTS } from '../../lib/utils'
import { initSupabase } from '../../lib/supabase'
import { AppSettings, FAQ, Holiday } from '../../types'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { settings, saveSettings, entries, saveEntries, staff, features, saveFeatures, lockedWeeks, saveLockedWeeks, user, notify } = useApp()
  const [tab, setTab] = useState<string>('general')
  const [sbUrl, setSbUrl] = useState<string>(typeof window !== 'undefined' ? localStorage.getItem('dsn_sb_url') || '' : '')
  const [showBulkImport, setShowBulkImport] = useState<boolean>(false)
  const [sbKey, setSbKey] = useState<string>(typeof window !== 'undefined' ? localStorage.getItem('dsn_sb_key') || '' : '')
  const [sbTesting, setSbTesting] = useState<boolean>(false)
  const [form, setForm] = useState<Partial<AppSettings>>({ ...(settings || {}) })
  const [annForm, setAnnForm] = useState(settings?.announcement || { message: '', icon: '📢', color: '#3B82F6', expires: '' })
  const [newCat, setNewCat] = useState<string>('')
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday>>({ date: '', name: '' })
  const [lockWeek, setLockWeek] = useState<string>('')
  const [fontSize, setFontSize] = useState<number>(local.get('font_size', 14))

  // Deleted entries
  const deletedEntries = entries.filter(e => e.deleted && (!e.deletedAt || (Date.now() - new Date(e.deletedAt).getTime()) < 30 * 24 * 60 * 60 * 1000))

  async function testSupabase() {
    if (!sbUrl || !sbKey) { toast.error('Enter URL and key first'); return }
    setSbTesting(true)
    try {
      const sb = initSupabase(sbUrl, sbKey)
      const { error } = await sb.from('_test_connection').select('*').limit(1)
      if (error && error.code !== 'PGRST116') throw error
      localStorage.setItem('dsn_sb_url', sbUrl)
      localStorage.setItem('dsn_sb_key', sbKey)
      toast.success('✅ Supabase connected successfully!')
    } catch (e: any) {
      toast.error('Connection failed: ' + (e.message || 'Check URL and key'))
    }
    setSbTesting(false)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500000) { toast.error('Logo must be under 500KB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      local.set('logo_url', result)
      toast.success('Logo uploaded! Refresh to see it.')
    }
    reader.readAsDataURL(file)
  }

  function saveGeneral() {
    saveSettings({ ...(settings || {}), ...form } as AppSettings)
    toast.success('Settings saved')
  }

  function savePoints() {
    saveSettings({ ...(settings || {}), points: form.points } as AppSettings)
    toast.success('Points config saved')
  }

  function saveAnnouncement() {
    saveSettings({ ...(settings || {}), announcement: annForm.message ? annForm : null } as AppSettings)
    toast.success(annForm.message ? 'Announcement posted' : 'Announcement cleared')
  }

  function addCategory() {
    if (!newCat.trim()) return
    const cats = [...(settings?.categories || []), newCat.trim()]
    saveSettings({ ...(settings || {}), categories: cats } as AppSettings)
    setNewCat('')
    toast.success('Category added')
  }

  function removeCategory(cat: string) {
    saveSettings({ ...(settings || {}), categories: (settings?.categories || []).filter(c => c !== cat) } as AppSettings)
  }

  function addHoliday() {
    if (!newHoliday.date || !newHoliday.name) { toast.error('Date and name required'); return }
    const holidays = [...(settings?.holidays || []), { ...newHoliday, id: genId() } as Holiday]
    saveSettings({ ...(settings || {}), holidays } as AppSettings)
    setNewHoliday({ date: '', name: '' })
    toast.success('Holiday added')
  }

  function lockUnlockWeek(week: string, lock: boolean) {
    const updated = lock ? [...lockedWeeks, week] : lockedWeeks.filter(w => w !== week)
    saveLockedWeeks(updated)
    toast.success(`Week ${lock ? 'locked' : 'unlocked'}`)
  }

  function restoreEntry(id: string) {
    saveEntries(entries.map(e => e.id === id ? { ...e, deleted: false, deletedAt: undefined } : e))
    toast.success('Entry restored')
  }

  function toggleFeature(key: string) {
    saveFeatures({ ...features, [key]: !features[key] })
  }

  const FEATURE_LABELS: Record<string, string> = {
    leaderboard: '🏆 Leaderboard',
    gamification: '🎮 Gamification & Points',
    messages: '💬 Messages',
    analytics: '📊 Analytics',
    leave_requests: '🏖️ Leave Requests',
    bulk_import: '📤 Bulk Import',
    dark_mode: '🌙 Dark Mode Toggle',
    pdf_export: '📄 PDF/CSV Export',
    org_chart: '🗂️ Org Chart',
    delegation: '👤 Delegation',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>⚙️ Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>System configuration and administration</p>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {['general', 'supabase', 'branding', 'points', 'workflow', 'features', 'content', 'data'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {/* GENERAL */}
      {tab === 'general' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>General Settings</h3>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">App Name</label>
              <input className="form-input" value={form.app_name || ''} onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Welcome Message</label>
              <input className="form-input" value={form.welcome_message || ''} onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Weekly Hour Cap (global)</label>
              <input className="form-input" type="number" value={form.weekly_cap || 45} onChange={e => setForm(f => ({ ...f, weekly_cap: parseInt(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Idle Timeout (minutes)</label>
              <input className="form-input" type="number" value={form.idle_minutes || 30} onChange={e => setForm(f => ({ ...f, idle_minutes: parseInt(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">2nd-Level Approval Threshold (hours)</label>
              <input className="form-input" type="number" value={form.second_level_threshold || 60} onChange={e => setForm(f => ({ ...f, second_level_threshold: parseInt(e.target.value) }))} />
              <span className="form-hint">Entries with hours above this require 2-level approval</span>
            </div>
            <div className="form-group">
              <label className="form-label">Approval Reminder (hours after submission)</label>
              <input className="form-input" type="number" value={form.approval_reminder_hours || 24} onChange={e => setForm(f => ({ ...f, approval_reminder_hours: parseInt(e.target.value) }))} />
            </div>
          </div>

          <div className="divider" />
          <h4 style={{ fontSize: 13, fontWeight: 700 }}>Week Locking</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Lock a Week (Mon date)</label>
              <input className="form-input" type="date" value={lockWeek} onChange={e => setLockWeek(e.target.value)} />
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => { if (lockWeek) lockUnlockWeek(lockWeek, true) }}>🔒 Lock Week</button>
          </div>
          {lockedWeeks.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lockedWeeks.map(w => (
                <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--danger-bg)', padding: '4px 10px', borderRadius: 20, fontSize: 12, color: 'var(--danger)' }}>
                  🔒 {w}
                  <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => lockUnlockWeek(w, false)}>×</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={saveGeneral}>Save Settings</button>
        </div>
      )}

      {/* SUPABASE */}
      {tab === 'supabase' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Supabase Connection</h3>
          <div style={{ background: 'var(--accent-subtle)', padding: '12px 16px', borderRadius: 8, fontSize: 13, color: 'var(--accent)' }}>
            💡 Connect Supabase to enable real-time sync and persistent data across devices. Without it, data is stored in localStorage (this device only).
          </div>
          <div className="form-group">
            <label className="form-label">Project URL</label>
            <input className="form-input" type="url" placeholder="https://xxxx.supabase.co" value={sbUrl} onChange={e => setSbUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Anon / Public API Key</label>
            <input className="form-input" type="password" placeholder="eyJhbGci..." value={sbKey} onChange={e => setSbKey(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={testSupabase} disabled={sbTesting}>
              {sbTesting ? 'Testing…' : '🔌 Test & Save Connection'}
            </button>
            {typeof window !== 'undefined' && localStorage.getItem('dsn_sb_url') && (
              <button className="btn btn-danger btn-sm" onClick={() => {
                localStorage.removeItem('dsn_sb_url')
                localStorage.removeItem('dsn_sb_key')
                setSbUrl(''); setSbKey('')
                toast.success('Supabase disconnected')
              }}>Disconnect</button>
            )}
          </div>
          {typeof window !== 'undefined' && localStorage.getItem('dsn_sb_url') && (
            <div style={{ background: 'var(--success-bg)', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: 'var(--success)' }}>
              ✅ Connected to: {localStorage.getItem('dsn_sb_url')}
            </div>
          )}
        </div>
      )}

      {/* BRANDING */}
      {tab === 'branding' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Branding</h3>
          <div className="form-group">
            <label className="form-label">Logo Upload (PNG/SVG, max 500KB)</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {local.get('logo_url', '') && (
                <img src={local.get('logo_url', '') as string} alt="Current logo" style={{ height: 48, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', padding: 4 }} />
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📤 Upload Logo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              </label>
              {local.get('logo_url', '') && (
                <button className="btn btn-danger btn-sm" onClick={() => { local.remove('logo_url'); toast.success('Logo removed') }}>Remove</button>
              )}
            </div>
            <span className="form-hint">Logo appears on login screen and sidebar. Recommended: 200×60px transparent PNG.</span>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Accent Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" value={form.accent_color || '#3B82F6'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} style={{ width: 48, height: 38, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
                <input className="form-input" value={form.accent_color || '#3B82F6'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
              </div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => {
            saveSettings({ ...(settings || {}), ...form } as AppSettings)
            document.documentElement.style.setProperty('--accent', form.accent_color || '#3B82F6')
            toast.success('Branding saved')
          }}>Save Branding</button>
        </div>
      )}

      {/* POINTS */}
      {tab === 'points' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Gamification — Points Config</h3>
          <div className="grid-2">
            {Object.entries(form.points || DEFAULT_POINTS).map(([key, val]) => (
              <div key={key} className="form-group">
                <label className="form-label">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                <input className="form-input" type="number" value={val as number} onChange={e => setForm(f => ({ ...f, points: { ...f.points, [key]: parseInt(e.target.value) } } as any))} />
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={savePoints}>Save Points Config</button>
        </div>
      )}

      {/* WORKFLOW */}
      {tab === 'workflow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Entry Categories</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(settings?.categories || []).map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '4px 12px', borderRadius: 20, fontSize: 13 }}>
                  {c}
                  <span style={{ cursor: 'pointer', color: 'var(--danger)', fontWeight: 700 }} onClick={() => removeCategory(c)}>×</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="New category name" value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <button className="btn btn-primary btn-sm" onClick={addCategory}>Add</button>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Public Holidays (deducted from weekly cap)</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(settings?.holidays || []).map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
                  📅 {h.date} — {h.name}
                  <span style={{ cursor: 'pointer', color: 'var(--danger)', fontWeight: 700 }} onClick={() => saveSettings({ ...(settings || {}), holidays: (settings?.holidays || []).filter(x => x.id !== h.id) } as AppSettings)}>×</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" type="date" value={newHoliday.date} onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))} style={{ flex: 'none', width: 160 }} />
              <input className="form-input" placeholder="Holiday name" value={newHoliday.name} onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))} />
              <button className="btn btn-primary btn-sm" onClick={addHoliday}>Add</button>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Announcement Banner</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Message</label>
                <input className="form-input" value={annForm.message} onChange={e => setAnnForm(f => ({ ...f, message: e.target.value }))} placeholder="Important update for all staff…" />
              </div>
              <div className="form-group">
                <label className="form-label">Icon</label>
                <input className="form-input" value={annForm.icon} onChange={e => setAnnForm(f => ({ ...f, icon: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Background Color</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="color" value={annForm.color} onChange={e => setAnnForm(f => ({ ...f, color: e.target.value }))} style={{ width: 48, height: 38, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                  <input className="form-input" value={annForm.color} onChange={e => setAnnForm(f => ({ ...f, color: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Expires (leave blank = permanent)</label>
                <input className="form-input" type="datetime-local" value={annForm.expires} onChange={e => setAnnForm(f => ({ ...f, expires: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveAnnouncement}>Post Announcement</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setAnnForm({ message: '', icon: '📢', color: '#3B82F6', expires: '' }); saveSettings({ ...(settings || {}), announcement: null } as AppSettings); toast.success('Announcement cleared') }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* FEATURES */}
      {tab === 'features' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Feature Toggles</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Enable or disable features for all users.</p>
          {Object.entries(FEATURE_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
              <div
                onClick={() => toggleFeature(key)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: features[key] ? 'var(--success)' : 'var(--bg-hover)',
                  border: '2px solid ' + (features[key] ? 'var(--success)' : 'var(--border)'),
                  cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 2,
                  left: features[key] ? 22 : 2,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONTENT / FAQ */}
      {tab === 'content' && (
        <FAQEditor settings={settings} saveSettings={saveSettings} />
      )}

      {/* DATA */}
      {tab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>📥 Bulk Time Entry Import</h3>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Import time entries for any staff via CSV/Excel. Updates all dashboards, analytics and staff profiles instantly.</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowBulkImport(true)}>Open Import Wizard</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🗑️ Deleted Entries (restorable within 30 days)</h3>
            {deletedEntries.length === 0 ? (
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No deleted entries</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deletedEntries.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e.project} — {e.staffName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.hours}h · {fmtDate(e.date)} · Deleted {e.deletedAt ? fmtDate(e.deletedAt) : 'N/A'}</div>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={() => restoreEntry(e.id)}>Restore</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>📦 Export Data</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(entries.filter(e => !e.deleted).map(e => ({ ID: e.id, Staff: e.staffName, Project: e.project, Lead: e.lead, Description: e.description, Date: e.date, Hours: e.hours, Category: e.category, Status: e.status, Week: e.weekKey })), 'all_entries.csv')}>
                ⬇ All Entries CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const logs = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('dsn_audit_logs') || '[]') : []
                exportCSV(logs.map((l: any) => ({ Action: l.action, Detail: l.detail, User: l.userName, Time: l.timestamp })), 'audit_log.csv')
              }}>
                ⬇ Audit Log CSV
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkImport && <BulkTimeEntryImport onClose={() => setShowBulkImport(false)} />}
    </div>
  )
}

interface FAQEditorProps {
  settings: AppSettings | null;
  saveSettings: (s: AppSettings) => void;
}

function FAQEditor({ settings, saveSettings }: FAQEditorProps) {
  const [faqs, setFaqs] = useState<FAQ[]>(settings?.faqs || [])
  const [newFaq, setNewFaq] = useState<Partial<FAQ>>({ q: '', a: '' })

  function addFaq() {
    if (!newFaq.q || !newFaq.a) { return }
    const updated = [...faqs, { ...newFaq, id: genId() } as FAQ]
    setFaqs(updated)
    saveSettings({ ...(settings || {}), faqs: updated } as AppSettings)
    setNewFaq({ q: '', a: '' })
    toast.success('FAQ added')
  }

  function removeFaq(id: string) {
    const updated = faqs.filter(f => f.id !== id)
    setFaqs(updated)
    saveSettings({ ...(settings || {}), faqs: updated } as AppSettings)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>❓ FAQ Editor</h3>
      {faqs.map(f => (
        <div key={f.id} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Q: {f.q}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>A: {f.a}</div>
            </div>
            <button className="btn btn-icon btn-danger btn-sm" onClick={() => removeFaq(f.id)}>✕</button>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
        <div className="form-group">
          <label className="form-label">Question</label>
          <input className="form-input" value={newFaq.q} onChange={e => setNewFaq(f => ({ ...f, q: e.target.value }))} placeholder="e.g. When is the submission deadline?" />
        </div>
        <div className="form-group">
          <label className="form-label">Answer</label>
          <textarea className="form-textarea" value={newFaq.a} onChange={e => setNewFaq(f => ({ ...f, a: e.target.value }))} placeholder="Answer…" rows={2} />
        </div>
        <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addFaq}>Add FAQ</button>
      </div>
    </div>
  )
}
