'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, getWeekKey, weekRange, fmtDate, logAudit, exportCSV, exportPDF, isSubmissionOpen, getSubmissionWindowStatus, formatTimeUntilDeadline } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Copy, Trash2, Edit2, Upload, Download, BookOpen, Save, CheckSquare, Square } from 'lucide-react'
import { Entry, Staff } from '../../types'
import PageHeader from '../common/PageHeader'
import ConfirmModal from '../common/ConfirmModal'

interface EntryFormProps {
  entry: Partial<Entry> | null;
  onSave: (form: any) => void;
  onClose: () => void;
  projects: any[];
  leads: Staff[];
  categories: string[];
  templates: any[];
  onSaveTemplate: (tpl: any) => void;
  windowOpen: boolean;
}

/* ────────────────────────────────────────────────────────────── */
/*  Entry Form                                                    */
/* ────────────────────────────────────────────────────────────── */
function EntryForm({ entry, onSave, onClose, projects, leads, categories, templates, onSaveTemplate, windowOpen }: EntryFormProps) {
  const today = new Date().toISOString().slice(0, 10)
  const fridayOfWeek = (() => {
    const d = new Date()
    const day = d.getDay() // 0=Sun,1=Mon,...,5=Fri,6=Sat
    const diff = day <= 5 ? 5 - day : 6 // if Sun (0), go to next Fri
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  })()
  const [form, setForm] = useState<any>({
    project: '', lead: '', description: '', startDate: today, endDate: fridayOfWeek,
    hours: '', category: 'Project Execution',
    isNewTask: false,
    ...(entry || {})
  })
  const [errors, setErrors] = useState<any>({})
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const F = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function validate() {
    const e: any = {}
    if (!form.project) e.project = 'Required'
    if (!form.lead && !form.leadId) e.lead = 'Required'
    if (!form.description) e.description = 'Required'
    if (!form.startDate) e.startDate = 'Required'
    if (!form.endDate) e.endDate = 'Required'
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = 'End must be ≥ start'
    if (!form.hours || parseFloat(form.hours) <= 0 || parseFloat(form.hours) > 24) e.hours = 'Must be 0.5–24'
    const selectedProj = projects.find((p: any) => p.name === form.project)
    if (selectedProj?.tasks?.length && !form.task) e.task = 'Required'
    return e
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ ...form, hours: parseFloat(form.hours) })
  }

  function applyTemplate(t: any) {
    setForm((f: any) => ({ ...f, project: t.project, lead: t.lead || '', description: t.description, category: t.category, hours: t.hours || '' }))
    setShowTemplates(false)
  }

  function saveTemplate() {
    if (!templateName.trim()) { toast.error('Enter a template name'); return }
    onSaveTemplate({ name: templateName.trim(), project: form.project, lead: form.lead, description: form.description, category: form.category, hours: form.hours })
    setTemplateName('')
    toast.success('Template saved')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{entry?.id ? 'Edit Entry' : 'Log Hours'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(!showTemplates)}>
              <BookOpen size={13} /> Templates
            </button>
            <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {showTemplates && (
          <div style={{ padding: '0 24px 16px', borderBottom: '1px solid var(--border)' }}>
            {templates.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>No saved templates yet. Fill the form and save as template below.</div>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates.map(t => (
                  <button key={t.id} className="chip" onClick={() => applyTemplate(t)} title={t.description}>
                    {t.name}
                  </button>
                ))}
              </div>
            }
          </div>
        )}

        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select className="form-input" value={form.project} onChange={e => {
                const proj = projects.find((p: any) => p.name === e.target.value)
                setForm((f: any) => ({ ...f, project: e.target.value, task: '', category: 'Project Execution' }))
              }}>
                <option value="">— Select project —</option>
                {projects.filter(p => p.active).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {errors.project && <span className="form-error">{errors.project}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Lead / Supervisor *</label>
              <select className="form-input" value={form.leadId || ''} onChange={e => {
                const selected = leads.find(l => l.id === e.target.value)
                setForm((f: any) => ({ ...f, leadId: e.target.value, lead: selected?.name || '' }))
              }}>
                <option value="">Select lead…</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {errors.lead && <span className="form-error">{errors.lead}</span>}
            </div>
          </div>

          {!windowOpen && (
            <div style={{
              background: form.isNewTask ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)',
              border: `1px solid ${form.isNewTask ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: form.isNewTask ? 'var(--success)' : 'var(--warning)' }}>
                  {form.isNewTask ? '🆕 New Task — Admin Review Required' : '⏰ Late Submission — Penalty Applies. Use this toggle for New Tasks'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {form.isNewTask
                    ? 'This entry will go to 2nd-level admin review and will not carry a late penalty.'
                    : 'Submission window is closed. This will be treated as a late entry and may incur a point deduction.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => F('isNewTask', !form.isNewTask)}
                style={{
                  flexShrink: 0, width: 48, height: 26, borderRadius: 13,
                  background: form.isNewTask ? 'var(--success)' : 'var(--bg-3)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: form.isNewTask ? 25 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }} />
              </button>
            </div>
          )}

          {(() => {
            const proj = projects.find((p: any) => p.name === form.project)
            if (!proj?.tasks?.length) return null
            return (
              <div className="form-group">
                <label className="form-label">Task *</label>
                <select className="form-select" value={form.task || ''} onChange={e => F('task', e.target.value)}>
                  <option value="">— Select task —</option>
                  {proj.tasks.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.task && <span className="form-error">{errors.task}</span>}
              </div>
            )
          })()}

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea className="form-textarea" placeholder="What did you work on?" value={form.description} onChange={e => F('description', e.target.value)} rows={3} />
            {errors.description && <span className="form-error">{errors.description}</span>}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-input" type="date" value={form.startDate || ''} onChange={e => { F('startDate', e.target.value); if (!form.endDate || form.endDate < e.target.value) F('endDate', e.target.value) }} />
              {errors.startDate && <span className="form-error">{errors.startDate}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input className="form-input" type="date" value={form.endDate || ''} min={form.startDate || ''} onChange={e => F('endDate', e.target.value)} />
              {errors.endDate && <span className="form-error">{errors.endDate}</span>}
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Hours *</label>
              <input className="form-input" type="number" step="0.5" min="0.5" max="24" placeholder="e.g. 4" value={form.hours} onChange={e => F('hours', e.target.value)} />
              {errors.hours && <span className="form-error">{errors.hours}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => F('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Save as template */}
          {!entry?.id && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
              <input className="form-input" placeholder="Save as template…" value={templateName} onChange={e => setTemplateName(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={saveTemplate}><Save size={13} /></button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{entry?.id ? 'Save Changes' : 'Add Entry'}</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Admin Override Modal                                          */
/* ────────────────────────────────────────────────────────────── */
interface AdminOverrideModalProps {
  entry: Entry;
  projects: any[];
  leads: Staff[];
  categories: string[];
  onSave: (form: Entry) => void;
  onClose: () => void;
}

function AdminOverrideModal({ entry, projects, leads, categories, onSave, onClose }: AdminOverrideModalProps) {
  const [form, setForm] = useState<Entry>({ ...entry })
  const F = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const STATUSES: Entry['status'][] = ['draft', 'submitted', 'approved', 'rejected', 'resubmitted']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <span className="modal-title">Admin Override</span>
            <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>Changes made here bypass normal approval flow</div>
          </div>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warning)', marginBottom: 4 }}>
            ⚠️ Admin override: {entry.staffName} — {entry.weekKey}
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-input" value={form.project} onChange={e => F('project', e.target.value)}>
                <option value="">— Select project —</option>
                {projects.filter(p => p.active).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Lead</label>
              <input className="form-input" list="admin-lead" value={form.lead || ''} onChange={e => F('lead', e.target.value)} />
              <datalist id="admin-lead">{leads.map(l => <option key={l.id} value={l.name} />)}</datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Hours</label>
              <input className="form-input" type="number" step="0.5" value={form.hours} onChange={e => F('hours', parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => F('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category || ''} onChange={e => F('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e => F('date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={e => F('description', e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">Override Note (visible in audit)</label>
            <input className="form-input" value={(form as any).overrideNote || ''} onChange={e => F('overrideNote', e.target.value)} placeholder="Reason for override…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Apply Override</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Resubmit Modal                                                */
/* ────────────────────────────────────────────────────────────── */
interface ResubmitModalProps {
  entry: Entry;
  onSave: (note: string) => void;
  onClose: () => void;
}

function ResubmitModal({ entry, onSave, onClose }: ResubmitModalProps) {
  const [note, setNote] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Resubmit Entry</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            <strong>Rejection reason:</strong> {entry.rejectionReason || 'No reason provided'}
          </div>
          <div className="form-group">
            <label className="form-label">Your Response (optional)</label>
            <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Explain changes made…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(note)}>Resubmit</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Clarify Modal                                                 */
/* ────────────────────────────────────────────────────────────── */
interface ClarifyModalProps {
  entry: Entry;
  onSave: (note: string) => void;
  onClose: () => void;
}

function ClarifyModal({ entry, onSave, onClose }: ClarifyModalProps) {
  const [note, setNote] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Explain/Clarify Entry</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: '1px solid var(--accent-subtle)' }}>
            <strong>Request:</strong> {entry.clarificationNote || 'No details provided'}
          </div>
          <div className="form-group" style={{ marginTop: 15 }}>
            <label className="form-label">Your Explanation *</label>
            <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Provide the details requested..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!note.trim()} onClick={() => onSave(note)}>Send Explanation</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Countdown Timer with Window Status                           */
/* ────────────────────────────────────────────────────────────── */
function CountdownTimer({ weekKey, submissionWindow }: { weekKey: string; submissionWindow?: any }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    const tick = () => {
      const windowStatus = getSubmissionWindowStatus(submissionWindow)
      setStatus(windowStatus)

      if (windowStatus.deadline) {
        setTimeLeft(formatTimeUntilDeadline(windowStatus.deadline))
      } else {
        // Fallback to old logic if no window configured
        const weekStart = new Date(weekKey)
        const deadline = new Date(weekStart)
        deadline.setDate(deadline.getDate() + 1) // Monday
        deadline.setDate(deadline.getDate() + 1) // Tuesday
        deadline.setHours(16, 0, 0, 0) // 4:00pm
        setTimeLeft(formatTimeUntilDeadline(deadline))
      }
    }

    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [weekKey, submissionWindow])

  if (!status) return null

  if (status.isClosed) {
    return (
      <div className="badge badge-gray" style={{ fontSize: 11, fontWeight: 700 }}>
        🔒 Window Closed
      </div>
    )
  }

  if (status.isPastDeadline) {
    return (
      <div className="badge badge-red" style={{ fontSize: 11, fontWeight: 700 }}>
        ⚠️ Late Submission ({status.penalty < 0 ? status.penalty : 0} pts penalty)
      </div>
    )
  }

  return (
    <div className="badge badge-yellow" style={{ fontSize: 11, fontWeight: 700 }}>
      ⏳ {timeLeft} left to submit
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Submission Confirmation Modal                                 */
/* ────────────────────────────────────────────────────────────── */
function SubmissionConfirmationModal({ entries, totalHours, cap, windowStatus, onConfirm, onClose }: any) {
  const isLate = windowStatus?.isPastDeadline
  const penalty = windowStatus?.penalty || 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Confirm Submission</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, marginBottom: 16 }}>You are about to submit <strong>{entries.length} entries</strong> totaling <strong>{totalHours}h</strong>.</p>

          {isLate && penalty < 0 && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', padding: '12px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, color: 'var(--danger)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Late Submission Warning</div>
              <div>You are submitting after the deadline. A penalty of <strong>{penalty} points</strong> will be applied.</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                Hours late: {Math.floor(windowStatus.hoursLate)}h | Penalty periods: {windowStatus.periodsLate}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Base Cap:</span>
              <span>{cap}h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: totalHours > cap ? 'var(--warning)' : 'var(--text-1)' }}>
              <span>Total Hours:</span>
              <span>{totalHours}h {totalHours > cap ? `(${totalHours - cap}h OT)` : ''}</span>
            </div>
            {isLate && penalty < 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontWeight: 700, color: 'var(--danger)' }}>
                <span>Late Penalty:</span>
                <span>{penalty} points</span>
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16 }}>Once submitted, this week will be locked for review.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {isLate && penalty < 0 ? 'Submit with Penalty' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  No Work Confirmation Modal                                    */
/* ────────────────────────────────────────────────────────────── */
function NoWorkConfirmationModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Mark this week as No Work?</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            You are about to mark this week as <strong>No Work</strong>.
          </p>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 12, borderRadius: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>ℹ️</span>
              <span style={{ fontWeight: 600 }}>This will:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-2)' }}>
              <li>Create a 0-hour entry marked as "No work this week"</li>
              <li>Submit it automatically for the current week</li>
              <li>Lock this week for further edits</li>
            </ul>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16 }}>
            Use this if you genuinely had no billable work this week.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>OK</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Main Page                                                     */
/* ────────────────────────────────────────────────────────────── */
export default function TimesheetPage() {
  const {
    user, entries, saveEntries, staff, projects, settings,
    notify, awardPoints, grantBadge, templates, saveTemplates,
    calculateWeekCap, submitWeekEntries, prefillTemplate, setPrefillTemplate,
    weekLocks
  } = useApp()
  const [selectedWeek, setSelectedWeek] = useState(getWeekKey())
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null) // admin: view another staff's sheet
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<Partial<Entry> | null>(null)
  const [overrideEntry, setOverrideEntry] = useState<Entry | null>(null)
  const [resubmitEntry, setResubmitEntry] = useState<Entry | null>(null)
  const [clarifyEntry, setClarifyEntry] = useState<Entry | null>(null)
  const [staffSearch, setStaffSearch] = useState('')
  const [showStaffSuggestions, setShowStaffSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showNoWorkModal, setShowNoWorkModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean, action: () => void, message: string, title?: string }>({ isOpen: false, action: () => { }, message: '' })
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([])

  useEffect(() => {
    if (prefillTemplate) {
      setEditEntry({
        project: prefillTemplate.project,
        lead: prefillTemplate.lead,
        description: prefillTemplate.description,
        hours: prefillTemplate.hours,
        category: prefillTemplate.category,
      })
      setShowForm(true)
      setPrefillTemplate(null)
    }
  }, [prefillTemplate])

  const isAdmin = user?.role === 'admin'
  const targetUser = isAdmin && viewingStaffId ? staff.find(s => s.id === viewingStaffId) : user
  const effectiveUserId = targetUser?.id || ''

  // A team lead cannot select themselves as their own reviewer
  const leads = staff.filter(s => (s.role === 'team_lead' || s.role === 'admin') && s.id !== user?.id)
  const categories = settings?.categories || ['Client Work', 'Internal', 'Training', 'Admin']

  const { cap: weekCap, isHoliday, isCDS } = calculateWeekCap(targetUser, selectedWeek)

  const isLocked = (weekLocks || []).some(l => l.weekId === selectedWeek && l.isLocked)

  const weeks = useMemo(() => {
    const r = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(); d.setDate(d.getDate() - i * 7); r.push(getWeekKey(d))
    }
    return r
  }, [])

  const currentWeek = getWeekKey()
  const isCurrentWeek = selectedWeek === currentWeek
  const isWindowOpen = isSubmissionOpen(settings?.submissionWindow)

  // Pending clarification entries across ALL weeks — shown in a banner so staff always see them
  const pendingClarifications = useMemo(() =>
    entries.filter(e => e.staffId === effectiveUserId && e.status === 'pending_clarification' && !e.deleted),
    [entries, effectiveUserId]
  )

  // Calculate submission window status
  const windowStatus = useMemo(() =>
    getSubmissionWindowStatus(settings?.submissionWindow),
    [settings?.submissionWindow]
  )

  // Only show entries for the effective user (staff privacy enforced)
  const weekEntries = useMemo(() => {
    let filtered = entries.filter(e => e.staffId === effectiveUserId && e.weekKey === selectedWeek && !e.deleted)

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter)
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [entries, effectiveUserId, selectedWeek, statusFilter])

  // Get all entries for status counts (unfiltered)
  const allWeekEntries = useMemo(() =>
    entries.filter(e => e.staffId === effectiveUserId && e.weekKey === selectedWeek && !e.deleted),
    [entries, effectiveUserId, selectedWeek]
  )

  // Status counts
  const statusCounts = useMemo(() => ({
    all: allWeekEntries.length,
    draft: allWeekEntries.filter(e => e.status === 'draft').length,
    submitted: allWeekEntries.filter(e => e.status === 'submitted').length,
    approved: allWeekEntries.filter(e => e.status === 'approved').length,
    rejected: allWeekEntries.filter(e => e.status === 'rejected').length,
    resubmitted: allWeekEntries.filter(e => e.status === 'resubmitted').length,
    pending_clarification: allWeekEntries.filter(e => e.status === 'pending_clarification').length,
    pending_2nd_approval: allWeekEntries.filter(e => e.status === 'pending_2nd_approval').length,
  }), [allWeekEntries])

  const totalHours = allWeekEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const isOver = totalHours > weekCap
  const submitted = allWeekEntries.some(e => ['submitted', 'approved', 'resubmitted'].includes(e.status))
  const hasRejected = allWeekEntries.some(e => e.status === 'rejected')
  const hasDraftEntries = allWeekEntries.some(e => e.status === 'draft')
  const canEdit = isAdmin || (!submitted && !isLocked)
  const isOwnSheet = effectiveUserId === user?.id
  // Allow adding new entries even after submission (unless week is locked)
  const canAddEntry = isOwnSheet && !isLocked
  const canSubmit = isOwnSheet && hasDraftEntries && !isLocked
  const myTemplates = templates.filter(t => t.staffId === user?.id)

  // Handle keyboard navigation in search suggestions
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showStaffSuggestions || searchStaff.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev + 1) % searchStaff.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev - 1 + searchStaff.length) % searchStaff.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = searchStaff[selectedSuggestionIndex]
      if (selected) {
        setViewingStaffId(selected.id)
        setStaffSearch('')
        setShowStaffSuggestions(false)
        setSelectedSuggestionIndex(0)
      }
    } else if (e.key === 'Escape') {
      setShowStaffSuggestions(false)
      setSelectedSuggestionIndex(0)
    }
  }

  // Semantic staff search with fuzzy matching
  const searchStaff = useMemo(() => {
    if (!staffSearch.trim()) return []

    const query = staffSearch.toLowerCase().trim()
    const results = staff
      .filter(s => s.id !== user?.id)
      .map(s => {
        const name = s.name.toLowerCase()
        const dept = (s.department || '').toLowerCase()
        const email = (s.email || '').toLowerCase()

        // Calculate relevance score
        let score = 0

        // Exact match gets highest score
        if (name === query) score += 100

        // Starts with query
        if (name.startsWith(query)) score += 50

        // Contains query
        if (name.includes(query)) score += 25

        // Department match
        if (dept.includes(query)) score += 15

        // Email match
        if (email.includes(query)) score += 10

        // Fuzzy match: all characters in order
        let queryIndex = 0
        for (let i = 0; i < name.length && queryIndex < query.length; i++) {
          if (name[i] === query[queryIndex]) {
            queryIndex++
            score += 5
          }
        }
        if (queryIndex === query.length) score += 20 // All chars found in order

        return { staff: s, score }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8) // Top 8 results
      .map(r => r.staff)

    return results
  }, [staffSearch, staff, user?.id])

  function updateEntry(entryId: string, updates: any) {
    saveEntries(entries.map(e => e.id === entryId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
  }

  function saveEntry(form: any) {
    const isEdit = !!editEntry?.id
    const leadMatch = leads.find(l => l.name.toLowerCase() === String(form.lead || '').toLowerCase())
    // If no lead specified in entry, inherit from staff member's leadId
    const inheritedLeadId = leadMatch?.id || form.leadId || targetUser?.leadId || ''
    const normalizedForm = { ...form, leadId: inheritedLeadId }
    if (!isEdit) {
      const similar = weekEntries.find(e => e.project === form.project && e.category === form.category)
      if (similar) {
        setConfirmAction({
          isOpen: true,
          action: () => {
            continueAddEntry(normalizedForm)
          },
          message: 'A similar entry (same project + category) already exists for this week. Add anyway?',
          title: 'Duplicate Entry Warning'
        })
        return
      }
    }

    continueAddEntry(normalizedForm)
  }

  function continueAddEntry(normalizedForm: any) {
    const isEdit = !!editEntry?.id

    if (isEdit && editEntry) {
      updateEntry(editEntry.id, normalizedForm)
      logAudit('EDIT_ENTRY', `${user?.name} edited entry for ${normalizedForm.project}`, user?.id || '', user?.name || '')
      toast.success('Entry updated')
    } else {
      const now = new Date().toISOString()
      const ne: Entry = {
        ...normalizedForm,
        id: genId(),
        staffId: effectiveUserId,
        staffName: targetUser?.name || '',
        weekKey: selectedWeek,
        status: 'draft',
        createdAt: now,
        updatedAt: now
      }
      saveEntries([...entries, ne])
      logAudit('ADD_ENTRY', `${user?.name} added entry for ${normalizedForm.project}`, user?.id || '', user?.name || '')
      toast.success('Entry added')
    }
    setShowForm(false); setEditEntry(null)
  }

  function deleteEntry(id: string) {
    setConfirmAction({
      isOpen: true,
      action: () => {
        saveEntries(entries.map(e => e.id === id ? { ...e, deleted: true, deletedAt: new Date().toISOString() } : e))
        logAudit('DELETE_ENTRY', `${user?.name} deleted entry`, user?.id || '', user?.name || '')
        toast.success('Deleted (restorable 30 days)')
      },
      message: 'Delete this entry? Restorable within 30 days.',
      title: 'Delete Entry'
    })
  }

  function bulkDeleteEntries() {
    if (selectedEntryIds.length === 0) return
    setConfirmAction({
      isOpen: true,
      action: () => {
        const now = new Date().toISOString()
        saveEntries(entries.map(e => selectedEntryIds.includes(e.id) ? { ...e, deleted: true, deletedAt: now } : e))
        logAudit('BULK_DELETE_ENTRIES', `${user?.name} bulk deleted ${selectedEntryIds.length} entries`, user?.id || '', user?.name || '')
        toast.success(`${selectedEntryIds.length} entries deleted`)
        setSelectedEntryIds([])
      },
      message: `Delete ${selectedEntryIds.length} selected entries? Restorable within 30 days.`,
      title: 'Bulk Delete Entries'
    })
  }

  function duplicateEntry(e: Entry) {
    // Ensure leadId is inherited from staff member if not set
    const inheritedLeadId = e.leadId || targetUser?.leadId || ''
    const ne: Entry = { ...e, id: genId(), status: 'draft', leadId: inheritedLeadId, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    saveEntries([...entries, ne])
    toast.success('Entry duplicated')
  }

  function applyAdminOverride(form: Entry) {
    const now = new Date().toISOString()
    saveEntries(entries.map(e => e.id === form.id ? { ...e, ...form, overriddenBy: user?.name, overriddenAt: now, updatedAt: now } : e))
    logAudit('ADMIN_OVERRIDE', `${user?.name} overrode entry for ${form.staffName}: ${(form as any).overrideNote || ''}`, user?.id || '', user?.name || '')
    setOverrideEntry(null)
    toast.success('Override applied')
  }

  function submitWeek() {
    if (!user) return
    setShowConfirm(true)
  }

  async function handleConfirmSubmit() {
    if (!user) return
    await submitWeekEntries(user.id, selectedWeek, totalHours)
    setShowConfirm(false)
    toast.success('✅ Timesheet submitted!')
  }

  function markNoWork() {
    setShowNoWorkModal(true)
  }

  function confirmNoWork() {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    const ne: Entry = {
      id: genId(),
      staffId: user.id || '',
      staffName: user.name || '',
      weekKey: selectedWeek,
      project: 'N/A',
      lead: '',
      leadId: user.leadId || '', // Inherit staff member's leadId
      description: 'No work this week',
      date: today,
      startDate: today,
      endDate: today,
      hours: 0,
      category: 'Admin',
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    saveEntries([...entries, ne])
    setShowNoWorkModal(false)
    toast.success('Marked as No Work')
  }

  function handleResubmit(note: string) {
    if (!resubmitEntry) return
    saveEntries(entries.map(e => e.id === resubmitEntry.id ? { ...e, status: 'resubmitted' as const, resubmitNote: note, updatedAt: new Date().toISOString() } : e))
    setResubmitEntry(null)
    toast.success('Resubmitted')
    logAudit('ENTRY_RESUBMIT', `Resubmitted entry: ${resubmitEntry.project}`, user?.id || '', user?.name || '')
  }

  function handleClarify(note: string) {
    if (!clarifyEntry) return
    const now = new Date().toISOString()
    const updated = entries.map(e => e.id === clarifyEntry.id ? {
      ...e,
      status: 'resubmitted' as const,
      resubmitNote: note,
      updatedAt: now
    } : e)
    saveEntries(updated)
    toast.success('Explanation sent')
    setClarifyEntry(null)
    logAudit('ENTRY_CLARIFY_RESPONSE', `Sent clarification for: ${clarifyEntry.project}`, user?.id || '', user?.name || '')
  }

  function handleSaveTemplate(tpl: any) {
    if (!user) return
    const newT = { ...tpl, id: genId(), staffId: user.id, createdAt: new Date().toISOString() }
    saveTemplates([...templates, newT])
  }

  function deleteTemplate(id: string) {
    saveTemplates(templates.filter(t => t.id !== id))
    toast.success('Template deleted')
  }

  function handleBulkImport(e: any) {
    const file = e.target.files[0]; if (!file) return
    import('xlsx').then(XLSX => {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target?.result as string, { type: 'binary' })
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
          const now = new Date().toISOString()
          const newEntries: Entry[] = rows.map(r => {
            const startDate = r['Start Date'] || r.startDate || r.Date || r.date || selectedWeek
            const endDate = r['End Date'] || r.endDate || startDate
            const leadName = r.Lead || r.lead || ''
            const leadMatch = leads.find(l => l.name.toLowerCase() === String(leadName).toLowerCase())
            // Inherit staff member's leadId if no lead specified in import
            const inheritedLeadId = leadMatch?.id || targetUser?.leadId || ''
            return {
              id: genId(),
              staffId: effectiveUserId,
              staffName: targetUser?.name || '',
              weekKey: selectedWeek,
              project: r.Project || r.project || '',
              lead: leadName,
              leadId: inheritedLeadId,
              description: r.Description || r.description || '',
              date: startDate,
              startDate,
              endDate,
              hours: parseFloat(r.Hours || r.hours || 0),
              category: r.Category || r.category || 'Client Work',
              status: 'draft' as const,
              createdAt: now,
              updatedAt: now
            }
          }).filter(r => r.project && r.hours && r.hours > 0)

          // Duplicate check
          const existing = entries.filter(e => e.staffId === effectiveUserId && e.weekKey === selectedWeek && !e.deleted)
          const filtered = newEntries.filter(nr => !existing.some(ex => ex.project === nr.project && ex.date === nr.date && Math.abs((ex.hours || 0) - nr.hours) < 0.5))
          saveEntries([...entries, ...filtered])
          toast.success(`Imported ${filtered.length} entries${newEntries.length - filtered.length > 0 ? `, skipped ${newEntries.length - filtered.length} duplicates` : ''}`)
        } catch { toast.error('Failed to parse file') }
      }
      reader.readAsBinaryString(file)
    })
    e.target.value = ''
  }

  function downloadTemplate() {
    const today = new Date().toISOString().slice(0, 10)
    exportCSV([
      {
        'Staff Name': targetUser?.name || '',
        Project: 'Project Alpha',
        Lead: 'John Doe',
        Description: 'Client meeting',
        'Start Date': today,
        'End Date': today,
        Hours: 2,
        Category: 'Client Work'
      }
    ], 'timesheet_template.csv')
  }

  async function handleExport(format: string) {
    const rows = weekEntries.map(e => ({ Date: fmtDate(e.date), Project: e.project, Lead: e.lead || '', Category: e.category || '', Description: e.description, Hours: e.hours, Status: e.status }))
    if (format === 'csv') {
      exportCSV(rows, `timesheet_${(targetUser)?.name?.replace(/ /g, '_')}_${selectedWeek}.csv`)
      toast.success('CSV exported')
    } else {
      try {
        await exportPDF(rows, [
          { key: 'Date', label: 'Date' }, { key: 'Project', label: 'Project' }, { key: 'Lead', label: 'Lead' },
          { key: 'Category', label: 'Category' }, { key: 'Description', label: 'Description' },
          { key: 'Hours', label: 'Hours' }, { key: 'Status', label: 'Status' },
        ], `Timesheet — ${(targetUser)?.name} — ${weekRange(selectedWeek)}`, `timesheet_${selectedWeek}.pdf`)
        toast.success('PDF exported')
      } catch { toast.error('PDF failed — use CSV') }
    }
  }

  const statusBadge: Record<string, string> = { draft: 'gray', submitted: 'blue', approved: 'green', rejected: 'red', resubmitted: 'yellow', pending_clarification: 'yellow' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        {/* Top Row: Title, Status Badge, and Primary Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>📋</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Timesheet</h1>
              {viewingStaffId && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
                  Viewing: <strong>{targetUser?.name}</strong>
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isCurrentWeek && <CountdownTimer weekKey={selectedWeek} submissionWindow={settings?.submissionWindow} />}
            {canAddEntry && (
              <button className="btn btn-primary" onClick={() => { setEditEntry(null); setShowForm(true) }}>
                <Plus size={14} /> Log Hours
              </button>
            )}
          </div>
        </div>

        {/* Second Row: Week Selector + Admin Search/View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Week:</span>
            <select className="form-select text-xs" style={{ width: 'auto', minWidth: 180 }} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
              {weeks.map(w => <option key={w} value={w}>{weekRange(w)}{w === currentWeek ? ' (current)' : ''}</option>)}
            </select>
          </div>

          {isAdmin && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 300, position: 'relative' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>View Staff:</span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    className="form-input text-xs"
                    style={{ width: '100%', maxWidth: 220 }}
                    placeholder="🔍 Search staff..."
                    value={staffSearch}
                    onChange={e => {
                      setStaffSearch(e.target.value)
                      setShowStaffSuggestions(true)
                      setSelectedSuggestionIndex(0)
                    }}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => setShowStaffSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowStaffSuggestions(false), 200)}
                  />
                  {showStaffSuggestions && searchStaff.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: 320,
                      overflowY: 'auto',
                      zIndex: 1000
                    }}>
                      {searchStaff.map((s, idx) => (
                        <div
                          key={s.id}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: idx < searchStaff.length - 1 ? '1px solid var(--border)' : 'none',
                            transition: 'background 0.15s',
                            background: idx === selectedSuggestionIndex ? 'var(--accent-subtle)' : viewingStaffId === s.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent'
                          }}
                          onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                          onClick={() => {
                            setViewingStaffId(s.id)
                            setStaffSearch('')
                            setShowStaffSuggestions(false)
                            setSelectedSuggestionIndex(0)
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {s.name}
                            {viewingStaffId === s.id && <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓ viewing</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                            {s.department || 'No department'} · {s.role}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <select className="form-select text-xs" style={{ width: 'auto', minWidth: 160, borderColor: viewingStaffId ? 'var(--warning)' : undefined }} value={viewingStaffId || ''} onChange={e => setViewingStaffId(e.target.value || null)}>
                  <option value="">My Timesheet</option>
                  {staff
                    .filter(s => s.id !== user?.id)
                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Third Row: Export/Import Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginRight: 4 }}>Actions:</span>
          <button className="btn btn-secondary btn-sm" title="Download CSV Template" onClick={downloadTemplate}>
            📄 Template
          </button>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={13} /> Import
            <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleBulkImport} />
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>
            <Download size={13} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>
            <Download size={13} /> PDF
          </button>
        </div>
      </div>

      {/* Dynamic Banners */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {isHoliday && (
          <div style={{ flex: 1, background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            🌴 <strong>Public Holiday Week:</strong> Cap reduced by 8h per holiday.
          </div>
        )}
        {isCDS && (
          <div style={{ flex: 1, background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8B5CF6', color: '#8B5CF6', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            🎓 <strong>Intern CDS:</strong> 8h deduction applied to your weekly cap.
          </div>
        )}
      </div>

      {/* Hours bar */}
      <div style={{ background: 'var(--bg-card)', border: `1px solid ${isOver ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>TOTAL HOURS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: isOver ? 'var(--danger)' : 'var(--text-1)' }}>
            {parseFloat(totalHours.toFixed(1))}h <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>/ {weekCap}h</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div className="progress" style={{ height: 8 }}>
            <div className="progress-bar" style={{ width: `${Math.min((totalHours / weekCap) * 100, 100)}%`, background: isOver ? 'var(--warning)' : totalHours >= weekCap * 0.8 ? 'var(--accent)' : 'var(--accent)' }} />
          </div>
          {isOver && <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>⚡ Overtime: Logging {(totalHours - weekCap).toFixed(1)}h beyond base cap</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {submitted && <span className="badge badge-green" style={{ fontSize: 13 }}>✅ Submitted</span>}
          {isLocked && <span className="badge badge-red">🔒 Locked</span>}
          {canSubmit && <button className="btn btn-primary" onClick={submitWeek}>📤 Submit Week</button>}
          {!isAdmin && !submitted && weekEntries.length === 0 && isCurrentWeek && (
            <button className="btn btn-secondary btn-sm" onClick={markNoWork}>No Work This Week</button>
          )}
        </div>
      </div>

      {isLocked && <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>🔒 Week locked by admin. No changes allowed.</div>}
      {hasRejected && <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>❌ Some entries were rejected. Review and resubmit below.</div>}

      {/* Pending clarification banner — visible regardless of which week is selected */}
      {pendingClarifications.length > 0 && !viewingStaffId && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
            ❓ {pendingClarifications.length} entr{pendingClarifications.length === 1 ? 'y needs' : 'ies need'} clarification
          </div>
          {pendingClarifications.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.project}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  Week of {weekRange(e.weekKey)} · {e.hours}h · {e.category}
                </div>
                {e.clarificationNote && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, fontStyle: 'italic' }}>
                    "{e.clarificationNote}"
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => {
                  if (selectedWeek !== e.weekKey) setSelectedWeek(e.weekKey)
                  setClarifyEntry(e)
                }}
              >
                Explain
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Template notice */}
      {myTemplates.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          📁 {myTemplates.length} saved template{myTemplates.length !== 1 ? 's' : ''} — click "Add Entry" → Templates to use them
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Need to import entries? Use our <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={downloadTemplate}>CSV template</span> (columns: Staff Name, Project, Lead, Description, Start Date, End Date, Hours, Category)
      </div>

      {/* Status Filter Tabs */}
      {allWeekEntries.length > 0 && (
        <div className="tabs" style={{ marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
          <button className={`tab ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
            All ({statusCounts.all})
          </button>
          {statusCounts.draft > 0 && (
            <button className={`tab ${statusFilter === 'draft' ? 'active' : ''}`} onClick={() => setStatusFilter('draft')}>
              Draft ({statusCounts.draft})
            </button>
          )}
          {statusCounts.submitted > 0 && (
            <button className={`tab ${statusFilter === 'submitted' ? 'active' : ''}`} onClick={() => setStatusFilter('submitted')}>
              Submitted ({statusCounts.submitted})
            </button>
          )}
          {statusCounts.resubmitted > 0 && (
            <button className={`tab ${statusFilter === 'resubmitted' ? 'active' : ''}`} onClick={() => setStatusFilter('resubmitted')}>
              Resubmitted ({statusCounts.resubmitted})
            </button>
          )}
          {statusCounts.approved > 0 && (
            <button className={`tab ${statusFilter === 'approved' ? 'active' : ''}`} onClick={() => setStatusFilter('approved')}>
              ✅ Approved ({statusCounts.approved})
            </button>
          )}
          {statusCounts.rejected > 0 && (
            <button className={`tab ${statusFilter === 'rejected' ? 'active' : ''}`} onClick={() => setStatusFilter('rejected')}>
              ❌ Rejected ({statusCounts.rejected})
            </button>
          )}
          {statusCounts.pending_clarification > 0 && (
            <button className={`tab ${statusFilter === 'pending_clarification' ? 'active' : ''}`} onClick={() => setStatusFilter('pending_clarification')}>
              Clarification ({statusCounts.pending_clarification})
            </button>
          )}
          {statusCounts.pending_2nd_approval > 0 && (
            <button className={`tab ${statusFilter === 'pending_2nd_approval' ? 'active' : ''}`} onClick={() => setStatusFilter('pending_2nd_approval')}>
              2nd Level ({statusCounts.pending_2nd_approval})
            </button>
          )}
        </div>
      )}

      {/* Entries table */}
      {weekEntries.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No entries {targetUser?.id !== user?.id ? `for ${targetUser?.name}` : ''} this week</div>
          {canAddEntry && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}><Plus size={14} /> Log Hours</button>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {selectedEntryIds.length > 0 && (
            <div style={{ padding: '10px 16px', background: 'var(--accent-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedEntryIds.length} selected</span>
              <button className="btn btn-danger btn-sm" onClick={bulkDeleteEntries}>
                <Trash2 size={12} /> Delete Selected
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEntryIds([])}>Clear</button>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <button
                      className="btn btn-icon btn-secondary btn-sm"
                      onClick={() => {
                        const deletable = weekEntries.filter(e => e.status === 'draft' || isAdmin).map(e => e.id)
                        if (selectedEntryIds.length === deletable.length) setSelectedEntryIds([])
                        else setSelectedEntryIds(deletable)
                      }}
                      title="Select all deletable entries"
                    >
                      {selectedEntryIds.length > 0 && selectedEntryIds.length === weekEntries.filter(e => e.status === 'draft' || isAdmin).length
                        ? <CheckSquare size={14} />
                        : <Square size={14} />}
                    </button>
                  </th>
                  <th>Dates</th><th>Project</th><th>Lead</th><th>Description</th>
                  <th>Category</th><th>Hours</th><th>Status</th>
                  {isAdmin && <th>Override</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {weekEntries.map(e => {
                  const isExpanded = expandedEntryId === e.id
                  const hasHistory = e.approvalHistory && e.approvalHistory.length > 0
                  const hasFeedback = e.rejectionReason || e.clarificationNote || e.correctionNote || e.resubmitNote || hasHistory

                  return (
                    <React.Fragment key={e.id}>
                      <tr style={{ background: e.overriddenBy ? 'rgba(245,158,11,0.04)' : '' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {(e.status === 'draft' || isAdmin) && !isLocked && (
                              <input
                                type="checkbox"
                                checked={selectedEntryIds.includes(e.id)}
                                onChange={() => {
                                  if (selectedEntryIds.includes(e.id)) setSelectedEntryIds(selectedEntryIds.filter(id => id !== e.id))
                                  else setSelectedEntryIds([...selectedEntryIds, e.id])
                                }}
                              />
                            )}
                            {hasFeedback && (
                              <button
                                className="btn btn-icon btn-secondary btn-sm"
                                onClick={() => setExpandedEntryId(isExpanded ? null : e.id)}
                                title="View feedback & approval history"
                                style={{ padding: '2px 6px' }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtDate(e.startDate || e.date)}
                          {e.endDate && e.endDate !== (e.startDate || e.date) && (
                            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>→ {fmtDate(e.endDate)}</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, maxWidth: 140 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.project}</div>
                          {e.overriddenBy && <div style={{ fontSize: 10, color: 'var(--warning)' }}>⚡ Overridden by {e.overriddenBy}</div>}
                        </td>
                        <td style={{ color: 'var(--text-3)' }}>{e.lead || '—'}</td>
                        <td style={{ maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.description}>{e.description}</div>
                        </td>
                        <td><span className="badge badge-blue">{e.category}</span></td>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{e.hours}h</td>
                        <td>
                          <span className={`badge badge-${statusBadge[e.status] || 'gray'}`}>{e.status}</span>
                          {hasFeedback && (
                            <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, cursor: 'pointer' }} onClick={() => setExpandedEntryId(isExpanded ? null : e.id)}>
                              💬 View feedback
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => setOverrideEntry(e)}>Override</button>
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {e.status === 'draft' && canEdit && !isLocked && (
                              <button className="btn btn-icon btn-secondary btn-sm" title="Edit" onClick={() => { setEditEntry(e); setShowForm(true) }}><Edit2 size={12} /></button>
                            )}
                            <button className="btn btn-icon btn-secondary btn-sm" title="Duplicate" onClick={() => duplicateEntry(e)}><Copy size={12} /></button>
                            {e.status === 'rejected' && !viewingStaffId && (
                              <button className="btn btn-success btn-sm" onClick={() => setResubmitEntry(e)}>Resubmit</button>
                            )}
                            {e.status === 'pending_clarification' && !viewingStaffId && (
                              <button className="btn btn-primary btn-sm" onClick={() => setClarifyEntry(e)}>Explain</button>
                            )}
                            {(e.status === 'draft' || isAdmin) && !isLocked && (
                              <button className="btn btn-icon btn-danger btn-sm" title="Delete" onClick={() => deleteEntry(e.id)}><Trash2 size={12} /></button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable details row */}
                      {isExpanded && hasFeedback && (
                        <tr>
                          <td colSpan={isAdmin ? 10 : 9} style={{ padding: 0, background: 'var(--bg-elevated)' }}>
                            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Rejection Reason */}
                                {e.rejectionReason && (
                                  <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginBottom: 4, textTransform: 'uppercase' }}>Rejection Reason</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{e.rejectionReason}</div>
                                    {e.rejectedBy && (
                                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                                        By: {staff.find(s => s.id === e.rejectedBy)?.name || e.rejectedBy} • {e.rejectedAt && fmtDate(e.rejectedAt)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Clarification Request */}
                                {e.clarificationNote && (
                                  <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 8, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase' }}>Clarification Requested</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{e.clarificationNote}</div>
                                  </div>
                                )}

                                {/* Correction Note */}
                                {e.correctionNote && (
                                  <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 8, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', marginBottom: 4, textTransform: 'uppercase' }}>Correction Applied</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{e.correctionNote}</div>
                                    {e.corrected && (
                                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                                        Hours were adjusted during approval
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Resubmit Note */}
                                {e.resubmitNote && (
                                  <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 8, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', marginBottom: 4, textTransform: 'uppercase' }}>Your Response</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{e.resubmitNote}</div>
                                  </div>
                                )}

                                {/* Approval History */}
                                {hasHistory && (
                                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase' }}>Approval History</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {e.approvalHistory!.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((h, idx) => (
                                        <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                                          <div style={{ fontSize: 18, flexShrink: 0 }}>
                                            {h.action === 'approved' ? '✅' : h.action === 'rejected' ? '❌' : h.action === 'clarification' ? '❓' : h.action === 'correction' ? '✏️' : '📋'}
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                              {h.action === 'approved' ? 'Approved' : h.action === 'rejected' ? 'Rejected' : h.action === 'clarification' ? 'Clarification Requested' : h.action === 'correction' ? 'Approved with Correction' : h.action}
                                              {h.correctedHours !== undefined && ` (${h.correctedHours}h)`}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                                              By: <strong>{h.reviewerName}</strong> ({h.reviewerRole}) • {fmtDate(h.timestamp)}
                                            </div>
                                            {h.note && (
                                              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, fontStyle: 'italic' }}>
                                                "{h.note}"
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <EntryForm
          entry={editEntry}
          onSave={saveEntry}
          onClose={() => { setShowForm(false); setEditEntry(null) }}
          projects={projects}
          leads={leads}
          categories={categories}
          templates={myTemplates}
          onSaveTemplate={handleSaveTemplate}
          windowOpen={isWindowOpen}
        />
      )}
      {overrideEntry && (
        <AdminOverrideModal
          entry={overrideEntry}
          projects={projects}
          leads={leads}
          categories={categories}
          onSave={applyAdminOverride}
          onClose={() => setOverrideEntry(null)}
        />
      )}
      {resubmitEntry && (
        <ResubmitModal entry={resubmitEntry} onSave={handleResubmit} onClose={() => setResubmitEntry(null)} />
      )}
      {clarifyEntry && (
        <ClarifyModal entry={clarifyEntry} onSave={handleClarify} onClose={() => setClarifyEntry(null)} />
      )}
      {showConfirm && (
        <SubmissionConfirmationModal
          entries={weekEntries}
          totalHours={totalHours}
          cap={weekCap}
          windowStatus={windowStatus}
          onConfirm={handleConfirmSubmit}
          onClose={() => setShowConfirm(false)}
        />
      )}
      {showNoWorkModal && (
        <NoWorkConfirmationModal
          onConfirm={confirmNoWork}
          onClose={() => setShowNoWorkModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.action}
        onCancel={() => setConfirmAction({ isOpen: false, action: () => { }, message: '' })}
      />
    </div>
  )
}
