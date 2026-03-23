'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, exportCSV, exportPDF, avatarColor, initials, logAudit } from '../../lib/utils'
import { db } from '../../lib/firebase'
import { doc, updateDoc, setDoc, deleteDoc, collection, onSnapshot, query } from 'firebase/firestore'
import { Search, Plus, Upload, Download, Edit2, UserX, UserCheck, Key, LogOut, Trash2, CheckSquare, Square } from 'lucide-react'
import toast from 'react-hot-toast'
import { Staff, Entry } from '../../types'

/* ─── Staff Modal ─────────────────────────────────────────────────── */
interface StaffModalProps {
  existing: Staff | null;
  allStaff: Staff[];
  onSave: (form: any) => void;
  onClose: () => void;
}

function StaffModal({ existing, allStaff, onSave, onClose }: StaffModalProps) {
  const leads = allStaff.filter(s => s.role === 'owner' || s.role === 'admin')
  const [form, setForm] = useState<any>(existing || { name: '', email: '', department: '', role: 'staff', leadId: '', leadName: '', phone: '', password: 'dsn-staff', first_login: true, weekly_cap: '' })
  const [errors, setErrors] = useState<any>({})
  const F = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function validate() {
    const e: any = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password || String(form.password).length < 4) e.password = 'Min 4 characters'
    return e
  }
  function submit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{existing ? 'Edit Staff Member' : 'Add New Staff'}</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => F('name', e.target.value)} placeholder="Jane Doe" />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => F('email', e.target.value)} placeholder="jane.doe@datasciencenigeria.ai" />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-input" value={form.department || ''} onChange={e => F('department', e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => F('role', e.target.value)}>
                <option value="staff">Staff</option>
                <option value="owner">Owner / Team Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reports To</label>
              <select className="form-select" value={form.leadId || ''} onChange={e => {
                const lead = leads.find(l => l.id === e.target.value)
                F('leadId', e.target.value); F('leadName', lead?.name || '')
              }}>
                <option value="">No Lead Assigned</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone || ''} onChange={e => F('phone', e.target.value)} placeholder="+234..." />
            </div>
            <div className="form-group">
              <label className="form-label">Initial Password *</label>
              <input className="form-input" type="password" value={form.password} onChange={e => F('password', e.target.value)} />
              {errors.password && <span className="form-error">{errors.password}</span>}
              <span className="form-hint">Default: dsn-staff. Staff will change on first login</span>
            </div>
            <div className="form-group">
              <label className="form-label">Weekly Cap Override (hrs)</label>
              <input className="form-input" type="number" value={form.weekly_cap || ''} onChange={e => F('weekly_cap', e.target.value)} placeholder="Blank = global cap" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>{existing ? 'Save Changes' : 'Add Staff'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Bulk Edit Modal ─────────────────────────────────────────────── */
interface BulkEditModalProps {
  count: number;
  allStaff: Staff[];
  onApply: (updates: any) => void;
  onClose: () => void;
}

function BulkEditModal({ count, allStaff, onApply, onClose }: BulkEditModalProps) {
  const leads = allStaff.filter(s => s.role === 'owner' || s.role === 'admin')
  const [fields, setFields] = useState<any>({ department: '', role: '', leadId: '', leadName: '', weekly_cap: '', password: '' })
  const [checks, setChecks] = useState<any>({ department: false, role: false, leadId: false, weekly_cap: false, password: false })
  const F = (k: string, v: any) => setFields((f: any) => ({ ...f, [k]: v }))
  const C = (k: string) => setChecks((c: any) => ({ ...c, [k]: !c[k] }))

  function apply() {
    const updates: any = {}
    if (checks.department && fields.department) updates.department = fields.department
    if (checks.role && fields.role) updates.role = fields.role
    if (checks.leadId && fields.leadId) { updates.leadId = fields.leadId; updates.leadName = fields.leadName }
    if (checks.weekly_cap && fields.weekly_cap) updates.weekly_cap = parseInt(fields.weekly_cap)
    if (checks.password && fields.password && fields.password.length >= 4) { updates.password = fields.password; updates.first_login = true }
    if (Object.keys(updates).length === 0) { toast.error('Select at least one field to update'); return }
    onApply(updates)
  }

  const Row = ({ field, label, children }: { field: string, label: string, children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => C(field)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: checks[field] ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }}>
        {checks[field] ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>
      <div style={{ width: 140, fontSize: 13, color: checks[field] ? 'var(--text-1)' : 'var(--text-3)', fontWeight: checks[field] ? 600 : 400 }}>{label}</div>
      <div style={{ flex: 1, opacity: checks[field] ? 1 : 0.4, pointerEvents: checks[field] ? 'auto' : 'none' }}>{children}</div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Bulk Edit — {count} staff selected</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
            ⚠️ Check a field to include it in the bulk update. Unchecked fields will not be changed.
          </div>
          <Row field="department" label="Department">
            <input className="form-input" value={fields.department} onChange={e => F('department', e.target.value)} placeholder="New department" />
          </Row>
          <Row field="role" label="Role">
            <select className="form-select" value={fields.role} onChange={e => F('role', e.target.value)}>
              <option value="">Select role</option>
              <option value="staff">Staff</option>
              <option value="owner">Owner / Lead</option>
              <option value="admin">Admin</option>
            </select>
          </Row>
          <Row field="leadId" label="Reports To">
            <select className="form-select" value={fields.leadId} onChange={e => {
              const lead = leads.find(l => l.id === e.target.value)
              F('leadId', e.target.value); F('leadName', lead?.name || '')
            }}>
              <option value="">Select lead</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Row>
          <Row field="weekly_cap" label="Weekly Cap (hrs)">
            <input className="form-input" type="number" value={fields.weekly_cap} onChange={e => F('weekly_cap', e.target.value)} placeholder="e.g. 40" style={{ maxWidth: 120 }} />
          </Row>
          <Row field="password" label="Reset Password">
            <input className="form-input" type="password" value={fields.password} onChange={e => F('password', e.target.value)} placeholder="New password" style={{ maxWidth: 160 }} />
          </Row>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={apply}>Apply to {count} Staff</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Import Preview Modal ────────────────────────────────────────── */
interface ImportPreviewModalProps {
  rows: any[];
  existingEmails: Set<string>;
  onConfirm: (rows: any[]) => void;
  onClose: () => void;
}

function ImportPreviewModal({ rows, existingEmails, onConfirm, onClose }: ImportPreviewModalProps) {
  const newRows = rows.filter(r => !existingEmails.has(r.email?.toLowerCase()))
  const dupeRows = rows.filter(r => existingEmails.has(r.email?.toLowerCase()))
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <span className="modal-title">Import Preview — {rows.length} rows</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <span className="badge badge-green">✅ {newRows.length} will be imported</span>
            <span className="badge badge-yellow">⚠️ {dupeRows.length} duplicates (skipped)</span>
          </div>
          {rows.length > 0 && (
            <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Status</th><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Lead</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isDupe = existingEmails.has(r.email?.toLowerCase())
                    return (
                      <tr key={i} style={{ background: isDupe ? 'var(--warning-bg)' : '' }}>
                        <td>{isDupe ? <span className="badge badge-yellow">Skip</span> : <span className="badge badge-green">New</span>}</td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.email}</td>
                        <td>{r.department}</td>
                        <td>{r.role}</td>
                        <td>{r.lead}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={newRows.length === 0} onClick={() => onConfirm(newRows)}>
            Import {newRows.length} Staff
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Compare Modal ───────────────────────────────────────────────── */
interface CompareModalProps {
  staffA: Staff;
  staffB: Staff;
  entries: Entry[];
  onClose: () => void;
}

function CompareModal({ staffA, staffB, entries, onClose }: CompareModalProps) {
  const stats = (s: Staff) => {
    const my = entries.filter(e => e.staffId === s.id && !e.deleted)
    const weeks = Array.from(new Set(my.map(e => e.weekKey)))
    const submitted = weeks.filter(w => my.some(e => e.weekKey === w && ['submitted', 'approved', 'resubmitted'].includes(e.status)))
    return {
      totalHours: my.reduce((a, e) => a + (e.hours || 0), 0),
      approvedHours: my.filter(e => e.status === 'approved').reduce((a, e) => a + (e.hours || 0), 0),
      submitRate: weeks.length ? Math.round((submitted.length / weeks.length) * 100) : 0,
      weeks: weeks.length, points: s.points || 0, streak: s.streak || 0, badges: (s.badges || []).length,
    }
  }
  const sA = stats(staffA), sB = stats(staffB)
  const Row = ({ label, a, b, unit = '' }: { label: string, a: number, b: number, unit?: string }) => (
    <tr>
      <td style={{ color: 'var(--text-3)', fontSize: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>{label}</td>
      <td style={{ fontWeight: 700, textAlign: 'center', color: a > b ? 'var(--success)' : a < b ? 'var(--danger)' : 'var(--text-1)', borderBottom: '1px solid var(--border)' }}>{a}{unit}</td>
      <td style={{ fontWeight: 700, textAlign: 'center', color: b > a ? 'var(--success)' : b < a ? 'var(--danger)' : 'var(--text-1)', borderBottom: '1px solid var(--border)' }}>{b}{unit}</td>
    </tr>
  )
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Staff Comparison</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}></th>
                {[staffA, staffB].map(s => (
                  <th key={s.id} style={{ textAlign: 'center', paddingBottom: 16 }}>
                    <div className="avatar avatar-md" style={{ background: avatarColor(s.name), margin: '0 auto 8px' }}>{initials(s.name)}</div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.department}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Total Hours" a={sA.totalHours} b={sB.totalHours} unit="h" />
              <Row label="Approved Hours" a={sA.approvedHours} b={sB.approvedHours} unit="h" />
              <Row label="Submit Rate" a={sA.submitRate} b={sB.submitRate} unit="%" />
              <Row label="Weeks Active" a={sA.weeks} b={sB.weeks} />
              <Row label="Points" a={sA.points} b={sB.points} />
              <Row label="Streak" a={sA.streak} b={sB.streak} unit="w" />
              <Row label="Badges" a={sA.badges} b={sB.badges} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────────────── */
export default function StaffPage() {
  const { staff, saveStaff, entries, leaves, saveLeaves, notify, user, settings, grantBadge, awardPoints } = useApp()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tab, setTab] = useState('staff')
  const [showModal, setShowModal] = useState(false)
  const [editStaff, setEditStaff] = useState<Staff | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [showCompare, setShowCompare] = useState(false)
  const [importRows, setImportRows] = useState<any[] | null>(null)
  const [activeSessions, setActiveSessions] = useState<any[]>([])

  const departments = useMemo(() => Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort(), [staff])

  // Subscribe to real-time active sessions from Firebase
  useEffect(() => {
    const q = query(collection(db, 'active_sessions'))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => d.data())
      // Filter out stale sessions (older than 2 mins) just in case cleanup failed
      const cutoff = Date.now() - 2 * 60 * 1000
      const active = data.filter((s: any) => new Date(s.lastSeen).getTime() > cutoff)
      setActiveSessions(active)
    })
    return () => unsub()
  }, [])

  const filtered = useMemo(() => staff.filter(s => {
    if (search && !s.name?.toLowerCase().includes(search.toLowerCase()) && !s.email?.toLowerCase().includes(search.toLowerCase()) && !s.department?.toLowerCase().includes(search.toLowerCase())) return false
    if (deptFilter && s.department !== deptFilter) return false
    if (roleFilter && s.role !== roleFilter) return false
    if (statusFilter === 'active' && s.suspended) return false
    if (statusFilter === 'suspended' && !s.suspended) return false
    return true
  }), [staff, search, deptFilter, roleFilter, statusFilter])

  /* ── Selection helpers ── */
  const allSelectedOnPage = filtered.length > 0 && filtered.every(s => selected.has(s.id))
  function toggleAll() {
    if (allSelectedOnPage) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  /* ── CRUD ── */
  function handleSave(form: any) {
    if (editStaff) {
      saveStaff(staff.map(s => s.id === editStaff.id ? { ...s, ...form } : s))
      logAudit('EDIT_STAFF', `${user?.name} edited ${form.name}`, user?.id || '', user?.name || '')
      toast.success('Staff updated')
    } else {
      if (staff.find(s => s.email?.toLowerCase() === form.email?.toLowerCase())) {
        toast.error('Email already exists'); return
      }
      const ns = { ...form, id: genId(), points: 0, streak: 0, badges: [], createdAt: new Date().toISOString() }
      saveStaff([...staff, ns])
      logAudit('ADD_STAFF', `${user?.name} added ${form.name}`, user?.id || '', user?.name || '')
      toast.success(form.name + ' added')
    }
    setShowModal(false); setEditStaff(null)
  }

  function handleDelete(ids: Set<string>) {
    const names = staff.filter(s => ids.has(s.id)).map(s => s.name).join(', ')
    if (!window.confirm(`Permanently delete ${ids.size} staff member(s): ${names}?\n\nThis cannot be undone.`)) return
    saveStaff(staff.filter(s => !ids.has(s.id)))
    logAudit('DELETE_STAFF', `${user?.name} deleted ${ids.size} staff`, user?.id || '', user?.name || '')
    setSelected(new Set())
    toast.success(`${ids.size} staff deleted`)
  }

  function toggleSuspend(s: Staff) {
    const action = s.suspended ? 'unsuspend' : 'suspend'
    if (!window.confirm(`${action} ${s.name}?`)) return
    saveStaff(staff.map(m => m.id === s.id ? { ...m, suspended: !m.suspended } : m))
    toast.success(`${s.name} ${action}d`)
  }

  function bulkSuspend(suspend: boolean) {
    if (!window.confirm(`${suspend ? 'Suspend' : 'Unsuspend'} ${selected.size} staff?`)) return
    saveStaff(staff.map(s => selected.has(s.id) ? { ...s, suspended: suspend } : s))
    logAudit(suspend ? 'BULK_SUSPEND' : 'BULK_UNSUSPEND', `${user?.name} ${suspend ? 'suspended' : 'unsuspended'} ${selected.size} staff`, user?.id || '', user?.name || '')
    setSelected(new Set()); toast.success(`Done`)
  }

  function handleBulkEdit(updates: any) {
    saveStaff(staff.map(s => selected.has(s.id) ? { ...s, ...updates } : s))
    logAudit('BULK_EDIT_STAFF', `${user?.name} bulk edited ${selected.size} staff`, user?.id || '', user?.name || '')
    setSelected(new Set()); setShowBulkEdit(false)
    toast.success(`${selected.size} staff updated`)
  }

  async function resetPassword(s: Staff) {
    if (!window.confirm(`Reset password for ${s.name} to "1234"?`)) return
    try {
      await updateDoc(doc(db, 'staff', s.id), {
        password: '1234',
        first_login: true,
        password_reset_pending: true
      })
      saveStaff(staff.map(m => m.id === s.id ? { ...m, password: '1234', first_login: true, password_reset_pending: true } : m))
      notify(s.id, 'Your password has been reset by admin to "1234". Please change it on next login.', 'info')
      toast.success('Password reset for ' + s.name)
    } catch (e: any) {
      toast.error('Failed to reset password.')
    }
  }

  async function forceLogout(s: Staff) {
    if (!window.confirm(`Force logout ${s.name}?`)) return
    try {
      // Set force_logout flag in Firestore
      await updateDoc(doc(db, 'staff', s.id), { force_logout: true })
      
      // Cleanup local (though AppContext will handle the real logout)
      const sessions = JSON.parse(localStorage.getItem('dsn_active_sessions') || '{}')
      delete sessions[s.id]
      localStorage.setItem('dsn_active_sessions', JSON.stringify(sessions))
      
      logAudit('FORCE_LOGOUT', `${user?.name} force logged out ${s.name}`, user?.id || '', user?.name || '')
      toast.success(s.name + ' logged out')
    } catch (e: any) {
      toast.error('Failed to force logout.')
    }
  }

  /* ── Export ── */
  function exportStaff(ids: Set<string> | null) {
    const rows = staff.filter(s => !ids || ids.has(s.id)).map(s => ({
      Name: s.name, Email: s.email, Department: s.department || '',
      Role: s.role, Lead: s.leadName || '', Phone: s.phone || '',
      Points: s.points || 0, Streak: s.streak || 0, Badges: (s.badges || []).length,
      Suspended: s.suspended ? 'Yes' : 'No', Joined: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
    }))
    exportCSV(rows, 'dsn_staff.csv')
    toast.success('Exported ' + rows.length + ' staff')
  }

  async function exportStaffPDF() {
    const rows = staff.map(s => ({
      name: s.name, email: s.email, department: s.department || '-',
      role: s.role, points: s.points || 0, suspended: s.suspended ? 'Yes' : 'No',
    }))
    try {
      await exportPDF(rows, [
        { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' }, { key: 'role', label: 'Role' },
        { key: 'points', label: 'Points' }, { key: 'suspended', label: 'Suspended' },
      ], 'DSN Staff Directory', 'dsn_staff_directory.pdf')
      toast.success('PDF exported')
    } catch { toast.error('PDF export failed — try CSV instead') }
  }

  function downloadTemplate() {
    exportCSV([{ Name: 'Jane Doe', Email: 'jane.doe@datasciencenigeria.ai', Department: 'Engineering', Role: 'staff', Lead: 'John Manager', Phone: '+2341234567', Password: 'admin' }], 'staff_import_template.csv')
  }

  /* ── Bulk import ── */
  function handleFileSelect(e: any) {
    const file = e.target.files[0]; if (!file) return
    import('xlsx').then(XLSX => {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target?.result as string, { type: 'binary' })
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
          const parsed = rows.map(r => ({
            name: r.Name || r.name || '',
            email: (r.Email || r.email || '').toLowerCase().trim(),
            department: r.Department || r.department || '',
            role: (r.Role || r.role || 'staff').toLowerCase(),
            lead: r.Lead || r.lead || '',
            phone: r.Phone || r.phone || '',
            pin: String(r.PIN || r.pin || '1234'),
          })).filter(r => r.name && r.email)
          setImportRows(parsed)
        } catch { toast.error('Failed to parse file') }
      }
      reader.readAsBinaryString(file)
    })
    e.target.value = ''
  }

  function confirmImport(rows: any[]) {
    const now = new Date().toISOString()
    const newStaff: Staff[] = rows.map(r => {
      const lead = staff.find(s => s.name === r.lead)
      return { id: genId(), name: r.name, email: r.email, department: r.department, role: r.role, leadId: lead?.id || '', leadName: lead?.name || r.lead, phone: r.phone, password: r.password || 'admin', first_login: true, points: 0, streak: 0, badges: [], createdAt: now }
    })
    saveStaff([...staff, ...newStaff])
    logAudit('BULK_IMPORT_STAFF', `${user?.name} imported ${rows.length} staff`, user?.id || '', user?.name || '')
    toast.success(`✅ Imported ${rows.length} staff members`)
    setImportRows(null)
  }

  /* ── Leave ── */
  function approveLeave(id: string) {
    const l = leaves.find((x: any) => x.id === id)
    saveLeaves(leaves.map((x: any) => x.id === id ? { ...x, status: 'approved', approvedBy: user?.name, approvedAt: new Date().toISOString() } : x))
    if (l) notify(l.staffId, '✅ Your leave request has been approved', 'approval')
    toast.success('Leave approved')
  }
  function rejectLeave(id: string, reason: string) {
    const l = leaves.find((x: any) => x.id === id)
    saveLeaves(leaves.map((x: any) => x.id === id ? { ...x, status: 'rejected', rejectionReason: reason } : x))
    if (l) notify(l.staffId, `❌ Leave request rejected: ${reason}`, 'rejection')
    toast.success('Leave rejected')
  }

  const pendingLeaves = leaves.filter((l: any) => l.status === 'pending')
  const staffA = staff.find(s => s.id === compareA)
  const staffB = staff.find(s => s.id === compareB)
  const existingEmails = useMemo(() => new Set(staff.map(s => s.email?.toLowerCase())), [staff])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>👥 Staff Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            {staff.length} members · {staff.filter(s => !s.suspended).length} active · {activeSessions.length} online now
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>📄 Template</button>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={13} /> Import
            <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleFileSelect} />
          </label>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => exportStaff(selected.size > 0 ? selected : null)}>
              <Download size={13} /> {selected.size > 0 ? `Export ${selected.size}` : 'Export All'}
            </button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportStaffPDF}>PDF</button>
          <button className="btn btn-primary" onClick={() => { setEditStaff(null); setShowModal(true) }}>
            <Plus size={14} /> Add Staff
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={'tab' + (tab === 'staff' ? ' active' : '')} onClick={() => setTab('staff')}>Staff List</div>
        <div className={'tab' + (tab === 'sessions' ? ' active' : '')} onClick={() => setTab('sessions')}>
          Active Sessions <span className="badge badge-green" style={{ marginLeft: 6 }}>{activeSessions.length}</span>
        </div>
        <div className={'tab' + (tab === 'leaves' ? ' active' : '')} onClick={() => setTab('leaves')}>
          Leave Requests {pendingLeaves.length > 0 && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>{pendingLeaves.length}</span>}
        </div>
        <div className={'tab' + (tab === 'compare' ? ' active' : '')} onClick={() => setTab('compare')}>Compare Staff</div>
      </div>

      {/* ── STAFF LIST TAB ── */}
      {tab === 'staff' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input className="form-input" placeholder="Search name, email, department…" value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()) }} style={{ paddingLeft: 34 }} />
            </div>
            <select className="form-select" style={{ width: 'auto' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{selected.size} selected</span>
              <div style={{ height: 16, width: 1, background: 'var(--border)' }} />
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkEdit(true)}>✏️ Bulk Edit</button>
              <button className="btn btn-secondary btn-sm" onClick={() => bulkSuspend(true)}>🚫 Suspend All</button>
              <button className="btn btn-secondary btn-sm" onClick={() => bulkSuspend(false)}>✅ Unsuspend All</button>
              <button className="btn btn-secondary btn-sm" onClick={() => exportStaff(selected)}>⬇ Export Selected</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected)}>🗑 Delete Selected</button>
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <button onClick={toggleAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: allSelectedOnPage ? 'var(--accent)' : 'var(--text-3)' }}>
                        {allSelectedOnPage ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Lead</th>
                    <th>Cap</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th>Online</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const isOnline = activeSessions.some(sess => sess.userId === s.id)
                    const cap = s.weekly_cap || settings?.weekly_cap || 45
                    return (
                      <tr key={s.id} style={{ background: selected.has(s.id) ? 'var(--accent-subtle)' : '' }}>
                        <td>
                          <button onClick={() => toggleOne(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: selected.has(s.id) ? 'var(--accent)' : 'var(--text-3)' }}>
                            {selected.has(s.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar avatar-sm" style={{ background: avatarColor(s.name), fontSize: 10, position: 'relative' }}>
                              {s.photo ? <img src={s.photo} alt="" /> : initials(s.name)}
                              {isOnline && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', border: '1.5px solid var(--bg-card)' }} />}
                            </div>
                            <span style={{ fontWeight: 600 }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.email}</td>
                        <td style={{ fontSize: 12 }}>{s.department || '—'}</td>
                        <td><span className={'badge badge-' + (s.role === 'admin' ? 'purple' : s.role === 'owner' ? 'blue' : 'gray')}>{s.role}</span></td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.leadName || '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{cap}h</td>
                        <td style={{ fontWeight: 700, color: 'var(--gold)' }}>{s.points || 0}</td>
                        <td><span className={'badge badge-' + (s.suspended ? 'red' : 'green')}>{s.suspended ? 'Suspended' : 'Active'}</span></td>
                        <td>
                          {isOnline
                            ? <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>● Online</span>
                            : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-icon btn-secondary btn-sm" title="Edit" onClick={() => { setEditStaff(s); setShowModal(true) }}><Edit2 size={12} /></button>
                            <button className="btn btn-icon btn-secondary btn-sm" title="Reset Password" onClick={() => resetPassword(s)}><Key size={12} /></button>
                            <button className="btn btn-icon btn-secondary btn-sm" title={s.suspended ? 'Unsuspend' : 'Suspend'} onClick={() => toggleSuspend(s)}>
                              {s.suspended ? <UserCheck size={12} /> : <UserX size={12} />}
                            </button>
                            <button className="btn btn-icon btn-danger btn-sm" title="Force Logout" onClick={() => forceLogout(s)}><LogOut size={12} /></button>
                            <button className="btn btn-icon btn-danger btn-sm" title="Delete" onClick={() => { const s2 = new Set([s.id]); handleDelete(s2) }}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">No staff found</div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Showing {filtered.length} of {staff.length} staff
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        </>
      )}

      {/* ── ACTIVE SESSIONS TAB ── */}
      {tab === 'sessions' && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-3)' }}>
            Sessions inactive for more than 5 minutes are automatically removed.
          </div>
          {activeSessions.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">💤</div>
              <div className="empty-state-title">No active sessions</div>
              <div className="empty-state-desc">No one is currently logged in</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Staff</th><th>Department</th><th>Role</th><th>Logged In</th><th>Last Seen</th><th>Action</th></tr></thead>
                  <tbody>
                    {activeSessions.map(sess => {
                      const s = staff.find(m => m.id === sess.userId)
                      if (!s) return null
                      return (
                        <tr key={sess.userId}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                              <div className="avatar avatar-sm" style={{ background: avatarColor(s.name), fontSize: 10 }}>{initials(s.name)}</div>
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-3)' }}>{s.department || '—'}</td>
                          <td><span className={'badge badge-' + (s.role === 'admin' ? 'purple' : s.role === 'owner' ? 'blue' : 'gray')}>{s.role}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(sess.loginAt).toLocaleTimeString()}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(sess.lastSeen).toLocaleTimeString()}</td>
                          <td><button className="btn btn-danger btn-sm" onClick={() => forceLogout(s)}>Force Logout</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {tab === 'leaves' && (
        leaves.length === 0
          ? <div className="empty-state card"><div className="empty-state-icon">🌴</div><div className="empty-state-title">No leave requests</div></div>
          : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {leaves.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((l: any) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.staffName}</td>
                        <td><span className="badge badge-blue">{l.type || 'Annual'}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l.from}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l.to}</td>
                        <td style={{ color: 'var(--text-3)', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason || '—'}</div></td>
                        <td><span className={'badge badge-' + (l.status === 'approved' ? 'green' : l.status === 'rejected' ? 'red' : 'yellow')}>{l.status}</span></td>
                        <td>
                          {l.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-success btn-sm" onClick={() => approveLeave(l.id)}>Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => { const r = prompt('Rejection reason:'); if (r) rejectLeave(l.id, r) }}>Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      {/* ── COMPARE TAB ── */}
      {tab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Staff A</label>
              <select className="form-select" value={compareA} onChange={e => setCompareA(e.target.value)}>
                <option value="">Select staff…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.department || s.role})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Staff B</label>
              <select className="form-select" value={compareB} onChange={e => setCompareB(e.target.value)}>
                <option value="">Select staff…</option>
                {staff.filter(s => s.id !== compareA).map(s => <option key={s.id} value={s.id}>{s.name} ({s.department || s.role})</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!compareA || !compareB} onClick={() => setShowCompare(true)}>
            Compare →
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && <StaffModal existing={editStaff} allStaff={staff} onSave={handleSave} onClose={() => { setShowModal(false); setEditStaff(null) }} />}
      {showBulkEdit && <BulkEditModal count={selected.size} allStaff={staff} onApply={handleBulkEdit} onClose={() => setShowBulkEdit(false)} />}
      {showCompare && staffA && staffB && <CompareModal staffA={staffA} staffB={staffB} entries={entries} onClose={() => setShowCompare(false)} />}
      {importRows && <ImportPreviewModal rows={importRows} existingEmails={existingEmails} onConfirm={confirmImport} onClose={() => setImportRows(null)} />}
    </div>
  )
}
