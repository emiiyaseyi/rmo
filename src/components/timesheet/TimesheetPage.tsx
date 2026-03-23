'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, getWeekKey, weekRange, fmtDate, logAudit, exportCSV, exportPDF, isSubmissionOpen } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Copy, Trash2, Edit2, Upload, Download, BookOpen, Save } from 'lucide-react'
import { Entry, Staff } from '../../types'

interface EntryFormProps {
  entry: Partial<Entry> | null;
  onSave: (form: any) => void;
  onClose: () => void;
  projects: any[];
  leads: Staff[];
  categories: string[];
  templates: any[];
  onSaveTemplate: (tpl: any) => void;
}

/* ────────────────────────────────────────────────────────────── */
/*  Entry Form                                                    */
/* ────────────────────────────────────────────────────────────── */
function EntryForm({ entry, onSave, onClose, projects, leads, categories, templates, onSaveTemplate }: EntryFormProps) {
  const [form, setForm] = useState<any>({
    project: '', lead: '', description: '', date: new Date().toISOString().slice(0, 10),
    hours: '', category: categories[0] || 'Client Work',
    ...(entry || {})
  })
  const [errors, setErrors] = useState<any>({})
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const F = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function validate() {
    const e: any = {}
    if (!form.project) e.project = 'Required'
    if (!form.description) e.description = 'Required'
    if (!form.date) e.date = 'Required'
    if (!form.hours || parseFloat(form.hours) <= 0 || parseFloat(form.hours) > 24) e.hours = 'Must be 0.5–24'
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
              <input className="form-input" list="proj-list" placeholder="Select or type…" value={form.project} onChange={e => F('project', e.target.value)} />
              <datalist id="proj-list">{projects.filter(p => p.active).map(p => <option key={p.id} value={p.name} />)}</datalist>
              {errors.project && <span className="form-error">{errors.project}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Lead / Supervisor</label>
              <input className="form-input" list="lead-list" placeholder="Select lead…" value={form.lead} onChange={e => F('lead', e.target.value)} />
              <datalist id="lead-list">{leads.map(l => <option key={l.id} value={l.name} />)}</datalist>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea className="form-textarea" placeholder="What did you work on?" value={form.description} onChange={e => F('description', e.target.value)} rows={3} />
            {errors.description && <span className="form-error">{errors.description}</span>}
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" value={form.date} onChange={e => F('date', e.target.value)} />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>
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
              <input className="form-input" list="admin-proj" value={form.project} onChange={e => F('project', e.target.value)} />
              <datalist id="admin-proj">{projects.filter(p => p.active).map(p => <option key={p.id} value={p.name} />)}</datalist>
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
/*  Countdown Timer                                               */
/* ────────────────────────────────────────────────────────────── */
function CountdownTimer({ weekKey }: { weekKey: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  
  useEffect(() => {
    const weekStart = new Date(weekKey)
    const deadline = new Date(weekStart)
    deadline.setDate(deadline.getDate() + 1) // Monday
    deadline.setDate(deadline.getDate() + 1) // Tuesday
    deadline.setHours(16, 0, 0, 0) // 4:00pm

    const tick = () => {
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()
      if (diff <= 0) { setTimeLeft('Deadline passed'); return }
      
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`)
    }
    
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [weekKey])

  return (
    <div className="badge badge-yellow" style={{ fontSize: 11, fontWeight: 700 }}>
       ⏳ {timeLeft} left to submit
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Submission Confirmation Modal                                 */
/* ────────────────────────────────────────────────────────────── */
function SubmissionConfirmationModal({ entries, totalHours, cap, onConfirm, onClose }: any) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Confirm Submission</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, marginBottom: 16 }}>You are about to submit <strong>{entries.length} entries</strong> totaling <strong>{totalHours}h</strong>.</p>
          <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Base Cap:</span>
              <span>{cap}h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: totalHours > cap ? 'var(--warning)' : 'var(--text-1)' }}>
              <span>Total Hours:</span>
              <span>{totalHours}h {totalHours > cap ? `(${totalHours - cap}h OT)` : ''}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16 }}>Once submitted, this week will be locked for review.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Confirm & Submit</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Main Page                                                     */
/* ────────────────────────────────────────────────────────────── */
export default function TimesheetPage() {
  const { user, entries, saveEntries, staff, projects, settings, notify, awardPoints, grantBadge, templates, saveTemplates, calculateWeekCap, submitWeekEntries } = useApp()
  const [selectedWeek, setSelectedWeek] = useState(getWeekKey())
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null) // admin: view another staff's sheet
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [overrideEntry, setOverrideEntry] = useState<Entry | null>(null)
  const [resubmitEntry, setResubmitEntry] = useState<Entry | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const isAdmin = user?.role === 'admin'
  const targetUser = isAdmin && viewingStaffId ? staff.find(s => s.id === viewingStaffId) : user
  const effectiveUserId = targetUser?.id || ''

  const leads = staff.filter(s => s.role === 'owner' || s.role === 'admin')
  const categories = settings?.categories || ['Client Work', 'Internal', 'Training', 'Admin']
  
  const { cap: weekCap, isHoliday, isCDS } = calculateWeekCap(targetUser, selectedWeek)

  const [lockedWeeks] = useState(() => {
    if (typeof window === 'undefined') return []
    return JSON.parse(localStorage.getItem('dsn_locked_weeks') || '[]')
  })
  const isLocked = lockedWeeks.includes(selectedWeek)

  const weeks = useMemo(() => {
    const r = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(); d.setDate(d.getDate() - i * 7); r.push(getWeekKey(d))
    }
    return r
  }, [])

  const currentWeek = getWeekKey()
  const isCurrentWeek = selectedWeek === currentWeek
  const isWindowOpen = isSubmissionOpen()

  // Only show entries for the effective user (staff privacy enforced)
  const weekEntries = useMemo(() =>
    entries.filter(e => e.staffId === effectiveUserId && e.weekKey === selectedWeek && !e.deleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries, effectiveUserId, selectedWeek]
  )

  const totalHours = weekEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const isOver = totalHours > weekCap
  const submitted = weekEntries.some(e => ['submitted', 'approved', 'resubmitted'].includes(e.status))
  const hasRejected = weekEntries.some(e => e.status === 'rejected')
  const canEdit = isAdmin || (!submitted && !isLocked)
  const canSubmit = !isAdmin && isWindowOpen && !submitted && weekEntries.length > 0 && !isLocked && isCurrentWeek && !isOver
  const myTemplates = templates.filter(t => t.staffId === user?.id)

  function updateEntry(entryId: string, updates: any) {
    saveEntries(entries.map(e => e.id === entryId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
  }

  function saveEntry(form: any) {
    const isEdit = !!editEntry?.id
    if (!isEdit) {
      const similar = weekEntries.find(e => e.project === form.project && e.category === form.category)
      if (similar && !window.confirm('A similar entry (same project + category) already exists for this week. Add anyway?')) return
    }

    if (isEdit && editEntry) {
      updateEntry(editEntry.id, form)
      toast.success('Entry updated')
    } else {
      const now = new Date().toISOString()
      const ne: Entry = {
        ...form,
        id: genId(),
        staffId: effectiveUserId,
        staffName: targetUser?.name || '',
        weekKey: selectedWeek,
        status: 'draft',
        createdAt: now,
        updatedAt: now
      }
      saveEntries([...entries, ne])
      toast.success('Entry added')
    }
    setShowForm(false); setEditEntry(null)
  }

  function deleteEntry(id: string) {
    if (!window.confirm('Delete this entry? Restorable within 30 days.')) return
    saveEntries(entries.map(e => e.id === id ? { ...e, deleted: true, deletedAt: new Date().toISOString() } : e))
    logAudit('DELETE_ENTRY', `${user?.name} deleted entry`, user?.id || '', user?.name || '')
    toast.success('Deleted (restorable 30 days)')
  }

  function duplicateEntry(e: Entry) {
    const ne: Entry = { ...e, id: genId(), status: 'draft', date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
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
    if (!user) return
    if (!window.confirm('Mark this week as No Work?')) return
    const ne: Entry = {
      id: genId(),
      staffId: user.id || '',
      staffName: user.name || '',
      weekKey: selectedWeek,
      project: 'N/A',
      lead: '',
      description: 'No work this week',
      date: selectedWeek,
      hours: 0,
      category: 'Admin',
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    saveEntries([...entries, ne])
    toast.success('Marked as No Work')
  }

  function handleResubmit(note: string) {
    if (!resubmitEntry) return
    saveEntries(entries.map(e => e.id === resubmitEntry.id ? { ...e, status: 'resubmitted', resubmitNote: note, updatedAt: new Date().toISOString() } : e))
    setResubmitEntry(null)
    toast.success('Resubmitted')
  }

  function handleSaveTemplate(tpl: any) {
    if (!user) return
    const newT = { ...tpl, id: genId(), ownerId: user.id, createdAt: new Date().toISOString() }
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
          const newEntries: Entry[] = rows.map(r => ({
            id: genId(),
            staffId: effectiveUserId,
            staffName: targetUser?.name || '',
            weekKey: selectedWeek,
            project: r.Project || r.project || '',
            lead: r.Lead || r.lead || '',
            description: r.Description || r.description || '',
            date: r.Date || r.date || selectedWeek,
            hours: parseFloat(r.Hours || r.hours || 0),
            category: r.Category || r.category || 'Client Work',
            status: 'draft' as const,
            createdAt: now,
            updatedAt: now
          })).filter(r => r.project && r.hours && r.hours > 0)

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
    exportCSV([{ Project: 'Project Alpha', Lead: 'John Doe', Description: 'Client meeting', Date: selectedWeek, Hours: 2, Category: 'Client Work' }], 'timesheet_template.csv')
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

  const statusBadge: Record<string, string> = { draft: 'gray', submitted: 'blue', approved: 'green', rejected: 'red', resubmitted: 'yellow' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>
            📋 Timesheet
            {viewingStaffId && <span style={{ fontSize: 13, color: 'var(--warning)', marginLeft: 10 }}>👁 Viewing: {targetUser?.name}</span>}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{weekRange(selectedWeek)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isCurrentWeek && isWindowOpen && <CountdownTimer weekKey={selectedWeek} />}
          {/* Admin: view another staff's timesheet */}
          {isAdmin && (
            <select className="form-select" style={{ width: 'auto', borderColor: viewingStaffId ? 'var(--warning)' : undefined }} value={viewingStaffId || ''} onChange={e => setViewingStaffId(e.target.value || null)}>
              <option value="">My Timesheet</option>
              {staff.filter(s => s.id !== user?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select className="form-select" style={{ width: 'auto' }} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
            {weeks.map(w => <option key={w} value={w}>{weekRange(w)}{w === currentWeek ? ' (current)' : ''}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>📄</button>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={13} /> Import
            <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleBulkImport} />
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}><Download size={13} /> CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>PDF</button>
          {canEdit && !isLocked && (
            <button className="btn btn-primary" onClick={() => { setEditEntry(null); setShowForm(true) }}>
              <Plus size={14} /> Log Hours
            </button>
          )}
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
          {!isAdmin && !submitted && weekEntries.length === 0 && isCurrentWeek && isWindowOpen && (
            <button className="btn btn-secondary btn-sm" onClick={markNoWork}>No Work This Week</button>
          )}
        </div>
      </div>

      {isLocked && <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>🔒 Week locked by admin. No changes allowed.</div>}
      {hasRejected && <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>❌ Some entries were rejected. Review and resubmit below.</div>}

      {/* Template notice */}
      {myTemplates.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          📁 {myTemplates.length} saved template{myTemplates.length !== 1 ? 's' : ''} — click "Add Entry" → Templates to use them
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Need to import entries? Use our <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={downloadTemplate}>CSV template</span> (columns: Project, Lead, Description, Date, Hours, Category)
      </div>

      {/* Entries table */}
      {weekEntries.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No entries {targetUser?.id !== user?.id ? `for ${targetUser?.name}` : ''} this week</div>
          {canEdit && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}><Plus size={14} /> Log Hours</button>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Project</th><th>Lead</th><th>Description</th>
                  <th>Category</th><th>Hours</th><th>Status</th>
                  {isAdmin && <th>Override</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {weekEntries.map(e => (
                  <tr key={e.id} style={{ background: e.overriddenBy ? 'rgba(245,158,11,0.04)' : '' }}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
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
                      {e.status === 'rejected' && e.rejectionReason && (
                        <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }} title={e.rejectionReason}>⚠️ {e.rejectionReason.slice(0, 30)}{e.rejectionReason.length > 30 ? '…' : ''}</div>
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
                        {(e.status === 'draft' || isAdmin) && !isLocked && (
                          <button className="btn btn-icon btn-danger btn-sm" title="Delete" onClick={() => deleteEntry(e.id)}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
      {showConfirm && (
        <SubmissionConfirmationModal
          entries={weekEntries}
          totalHours={totalHours}
          cap={weekCap}
          onConfirm={handleConfirmSubmit}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
