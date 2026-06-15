'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, fmtDate } from '../../lib/utils'
import { Leave, LeaveType } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

const LEAVE_TYPES: { value: LeaveType; label: string; icon: string }[] = [
  { value: 'annual', label: 'Annual Leave', icon: '🌴' },
  { value: 'sick', label: 'Sick Leave', icon: '🤒' },
  { value: 'maternity', label: 'Maternity', icon: '🤱' },
  { value: 'paternity', label: 'Paternity', icon: '👶' },
  { value: 'compassionate', label: 'Compassionate', icon: '🕊️' },
  { value: 'study', label: 'Study Leave', icon: '📚' },
  { value: 'unpaid', label: 'Unpaid Leave', icon: '⏸️' },
  { value: 'other', label: 'Other', icon: '📌' },
]

function typeMeta(t: string) {
  return LEAVE_TYPES.find(x => x.value === t) || { value: t, label: t, icon: '📌' }
}

function leaveIsActive(l: Leave, ref: Date = new Date()): boolean {
  const today = ref.toISOString().slice(0, 10)
  return l.status === 'approved' && l.fromDate <= today && l.toDate >= today
}

export default function LeavePage() {
  const { user, staff, leaves, saveLeave, deleteLeave } = useApp()
  const isAdmin = user?.role === 'admin'

  const [form, setForm] = useState({
    staffId: '',
    type: 'annual' as LeaveType,
    fromDate: '',
    toDate: '',
    reason: '',
  })
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<{ open: boolean; action: () => void; message: string }>({ open: false, action: () => {}, message: '' })

  // Staff log their own; admin logs on behalf of selected staff
  function submitLeave() {
    const targetId = isAdmin ? form.staffId : user!.id
    if (!targetId) { toast.error('Select a staff member'); return }
    if (!form.fromDate || !form.toDate) { toast.error('From and To dates required'); return }
    if (form.fromDate > form.toDate) { toast.error('From date must be before To date'); return }

    const target = staff.find(s => s.id === targetId)
    if (!target) { toast.error('Staff not found'); return }

    const now = new Date().toISOString()
    const leave: Leave = {
      id: genId(),
      staffId: targetId,
      staffName: target.name,
      type: form.type,
      fromDate: form.fromDate,
      toDate: form.toDate,
      reason: form.reason.trim() || undefined,
      // Auto-logged — instantly active, no approval workflow (HR=Admin model)
      status: 'approved',
      approvedBy: user!.name,
      approvedAt: now,
      leadId: target.leadId || undefined,
      createdAt: now,
    }
    saveLeave(leave)
    setForm({ staffId: '', type: 'annual', fromDate: '', toDate: '', reason: '' })
    toast.success(isAdmin ? `Leave logged for ${target.name}` : 'Leave logged')
  }

  function removeLeave(l: Leave) {
    setConfirm({
      open: true,
      message: `Delete ${typeMeta(l.type).label} for ${l.staffName} (${l.fromDate} → ${l.toDate})?`,
      action: () => { deleteLeave(l.id); toast.success('Leave record deleted') },
    })
  }

  const visibleLeaves = useMemo(() => {
    const list = isAdmin ? leaves : leaves.filter(l => l.staffId === user?.id)
    const q = search.trim().toLowerCase()
    return list
      .filter(l => !q || l.staffName.toLowerCase().includes(q) || typeMeta(l.type).label.toLowerCase().includes(q))
      .sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''))
  }, [leaves, isAdmin, user?.id, search])

  const activeCount = visibleLeaves.filter(l => leaveIsActive(l)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🌴 Leave & Absence</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          {isAdmin
            ? 'Log leave on behalf of staff. Staff on active leave are not flagged as non-compliant.'
            : 'Log your leave so the platform does not flag you as non-compliant during your absence.'}
        </p>
      </div>

      {/* Log form */}
      <div className="card flex flex-col gap-4">
        <h3 className="font-bold">{isAdmin ? 'Log Leave / Absence (on behalf of staff)' : 'Log My Leave'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {isAdmin && (
            <div className="form-group">
              <label className="form-label">Staff Member</label>
              <select className="form-select" value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Select staff...</option>
                {[...staff].filter(s => !s.suspended).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LeaveType })}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={form.fromDate} max={form.toDate || undefined} onChange={e => setForm({ ...form, fromDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={form.toDate} min={form.fromDate || undefined} onChange={e => setForm({ ...form, toDate: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Reason (optional)</label>
          <input className="form-input" placeholder="e.g. Family event, medical appointment..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </div>
        <div>
          <button className="btn btn-primary" onClick={submitLeave}>✨ Log Leave</button>
        </div>
      </div>

      {/* Records */}
      <div className="card flex flex-col gap-3" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold">
            {isAdmin ? 'All Leave Records' : 'My Leave Records'}
            {activeCount > 0 && <span className="badge badge-green" style={{ marginLeft: 8 }}>{activeCount} active now</span>}
          </h3>
          {isAdmin && (
            <input className="form-input" placeholder="Search name or type..." value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 220, maxWidth: 280 }} />
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>Staff</th>}
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleLeaves.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No leave records yet</td></tr>
              )}
              {visibleLeaves.map(l => {
                const meta = typeMeta(l.type)
                const active = leaveIsActive(l)
                return (
                  <tr key={l.id} className={active ? 'bg-accent-subtle' : ''}>
                    {isAdmin && <td className="font-bold">{l.staffName}</td>}
                    <td>{meta.icon} {meta.label}</td>
                    <td className="font-mono text-xs">{fmtDate(l.fromDate)}</td>
                    <td className="font-mono text-xs">{fmtDate(l.toDate)}</td>
                    <td className="text-xs text-3 max-w-xs truncate" title={l.reason}>{l.reason || '—'}</td>
                    <td>
                      {active
                        ? <span className="badge badge-green">On leave now</span>
                        : <span className="badge badge-yellow">{l.status === 'approved' ? 'Logged' : l.status}</span>}
                    </td>
                    <td>
                      {(isAdmin || l.staffId === user?.id) && (
                        <button className="btn btn-icon text-danger" title="Delete" onClick={() => removeLeave(l)}>🗑️</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirm.open}
        title="Confirm Deletion"
        message={confirm.message}
        onConfirm={confirm.action}
        onCancel={() => setConfirm({ open: false, action: () => {}, message: '' })}
      />
    </div>
  )
}
