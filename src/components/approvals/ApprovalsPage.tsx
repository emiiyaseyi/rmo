'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate, weekRange, genId, logAudit } from '../../lib/utils'
import { Staff, Entry } from '../../types'
import toast from 'react-hot-toast'

interface ApprovalModalProps {
  entry: Entry;
  staff: Staff[];
  onClose: () => void;
  onAction: (entryId: string, action: string, note: string, correctedHours: number) => void;
}

function ApprovalModal({ entry, staff, onClose, onAction }: ApprovalModalProps) {
  const [action, setAction] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [correctedHours, setCorrectedHours] = useState<number>(entry.hours)

  const submitter = staff.find(s => s.id === entry.staffId)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Review Entry</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Entry details */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="grid-2">
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Staff</span><strong>{entry.staffName}</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Department</span>{submitter?.department || '—'}</div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Project</span><strong>{entry.project}</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Lead</span>{entry.lead || '—'}</div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Date</span>{fmtDate(entry.date)}</div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Hours</span><strong>{entry.hours}h</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Category</span>{entry.category}</div>
              <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Week</span>{weekRange(entry.weekKey)}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Description</span>
              <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{entry.description}</p>
            </div>
            {entry.resubmitNote && (
              <div style={{ background: 'var(--warning-bg)', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--warning)' }}>
                <strong>Resubmit note:</strong> {entry.resubmitNote}
              </div>
            )}
          </div>

          {/* Action picker */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['approve', 'approve_correction', 'reject', 'clarify'].map(a => (
              <button
                key={a}
                className={`btn ${action === a ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setAction(a)}
              >
                {a === 'approve' ? '✅ Approve' : a === 'approve_correction' ? '✏️ Approve w/ Correction' : a === 'reject' ? '❌ Reject' : '❓ Request Clarification'}
              </button>
            ))}
          </div>

          {action === 'approve_correction' && (
            <div className="form-group">
              <label className="form-label">Corrected Hours</label>
              <input className="form-input" type="number" step="0.5" value={correctedHours} onChange={e => setCorrectedHours(parseFloat(e.target.value))} />
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Correction Note</label>
                <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Explain the correction..." />
              </div>
            </div>
          )}

          {(action === 'reject' || action === 'clarify') && (
            <div className="form-group">
              <label className="form-label">{action === 'reject' ? 'Rejection Reason *' : 'Clarification Request *'}</label>
              <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder={action === 'reject' ? 'Explain why...' : 'What needs clarification?'} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!action || ((action === 'reject' || action === 'clarify') && !note)}
            onClick={() => onAction(entry.id, action, note, correctedHours)}
          >
            Submit Decision
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const { user, staff, entries, saveEntries, settings, notify, awardPoints } = useApp()
  const [tab, setTab] = useState<string>('pending')
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [filterDept, setFilterDept] = useState<string>('')
  const [filterWeek, setFilterWeek] = useState<string>('')

  const secondLevelThreshold = (settings?.second_level_threshold as number) || 60

  // Which entries this approver can see
  const relevantEntries: Entry[] = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') {
      return entries.filter(e => !e.deleted)
    }
    if (user.role === 'owner') {
      const myStaffIds = staff.filter(s => s.leadId === user.id).map(s => s.id)
      return entries.filter(e => myStaffIds.includes(e.staffId) && !e.deleted)
    }
    return []
  }, [entries, staff, user])

  const pending = relevantEntries.filter(e => ['submitted', 'resubmitted'].includes(e.status))
  const history = relevantEntries.filter(e => ['approved', 'rejected'].includes(e.status))

  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean).map(d => d as string)))
  const weeks = Array.from(new Set(relevantEntries.map(e => e.weekKey))).sort().reverse()

  function getFilteredPending(): Entry[] {
    return pending.filter(e => {
      const s = staff.find(m => m.id === e.staffId)
      if (filterDept && s?.department !== filterDept) return false
      if (filterWeek && e.weekKey !== filterWeek) return false
      return true
    })
  }

  function handleAction(entryId: string, action: string, note: string, correctedHours: number) {
    if (!user) return
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return

    const now = new Date().toISOString()
    let updates: Partial<Entry> = {}

    switch (action) {
      case 'approve':
        updates = { status: 'approved' as const, approvedAt: now, approvedBy: user.id, approvedByName: user.name }
        // Award points to staff
        const pts = (settings?.points?.approved as number) || 5
        awardPoints(entry.staffId, pts, 'Entry approved')
        notify(entry.staffId, `✅ Your entry "${entry.project}" was approved`, 'approval')
        break
      case 'approve_correction':
        updates = {
          status: 'approved' as const, approvedAt: now, approvedBy: user.id, approvedByName: user.name,
          hours: correctedHours, correctionNote: note, corrected: true
        }
        awardPoints(entry.staffId, (settings?.points?.approved as number) || 5, 'Entry approved')
        notify(entry.staffId, `✅ Entry approved with correction (${correctedHours}h): ${note}`, 'approval')
        break
      case 'reject':
        updates = { status: 'rejected' as const, rejectedAt: now, rejectedBy: user.id, rejectionReason: note }
        notify(entry.staffId, `❌ Entry rejected: ${note}`, 'rejection')
        break
      case 'clarify':
        updates = { status: 'clarification_needed' as const, clarifyNote: note }
        notify(entry.staffId, `❓ Clarification needed: ${note}`, 'info')
        break
    }

    const updated = entries.map(e => e.id === entryId ? { ...e, ...updates } : e)
    saveEntries(updated)
    logAudit(`APPROVAL_${action.toUpperCase()}`, `${user.name} ${action}d entry by ${entry.staffName}`, user.id, user.name)
    toast.success(`Entry ${action}d`)
    setSelectedEntry(null)
  }

  function bulkApprove(ids: string[]) {
    if (!user) return
    if (!window.confirm(`Approve ${ids.length} entries?`)) return
    const now = new Date().toISOString()
    const updated = entries.map(e =>
      ids.includes(e.id) && ['submitted', 'resubmitted'].includes(e.status)
        ? { ...e, status: 'approved' as const, approvedAt: now, approvedBy: user.id, approvedByName: user.name }
        : e
    )
    saveEntries(updated)
    // Award points
    const affectedEntries = entries.filter(e => ids.includes(e.id))
    affectedEntries.forEach(e => {
      awardPoints(e.staffId, (settings?.points?.approved as number) || 5, 'Entry approved')
      notify(e.staffId, `✅ Entry "${e.project}" was approved`, 'approval')
    })
    toast.success(`${ids.length} entries approved`)
  }

  const displayPending = getFilteredPending()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Approvals</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Review and action timesheet submissions</p>
      </div>

      {/* Stats */}
      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: pending.length > 0 ? 'var(--warning)' : 'var(--success)' }}>{pending.length}</div>
          <div className="stat-sub">{pending.length > 0 ? 'Requires action' : 'All caught up!'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved (All time)</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{history.filter(e => e.status === 'approved').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected (All time)</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{history.filter(e => e.status === 'rejected').length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          Pending {pending.length > 0 && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>{pending.length}</span>}
        </div>
        <div className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Approval History</div>
      </div>

      {tab === 'pending' && (
        <>
          {/* Filters + bulk approve */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" style={{ width: 'auto' }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
              <option value="">All Weeks</option>
              {weeks.map(w => <option key={w} value={w}>{weekRange(w)}</option>)}
            </select>
            {displayPending.length > 0 && (
              <button className="btn btn-success btn-sm" onClick={() => bulkApprove(displayPending.map(e => e.id))}>
                ✅ Approve All Visible ({displayPending.length})
              </button>
            )}
          </div>

          {displayPending.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No pending approvals</div>
              <div className="empty-state-desc">All submissions have been reviewed</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Dept</th>
                      <th>Project</th>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Category</th>
                      <th>Week</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPending.map(e => {
                      const s = staff.find(m => m.id === e.staffId)
                      const needsSecondLevel = e.hours >= secondLevelThreshold
                      return (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                          <td style={{ color: 'var(--text-3)' }}>{s?.department || '—'}</td>
                          <td>{e.project}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(e.date)}</td>
                          <td style={{ fontWeight: 700 }}>
                            {e.hours}h
                            {needsSecondLevel && <span title="Requires 2nd level approval" style={{ marginLeft: 4, fontSize: 14 }}>⚠️</span>}
                          </td>
                          <td><span className="badge badge-blue">{e.category}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                          <td>
                            <span className={`badge badge-${e.status === 'resubmitted' ? 'yellow' : 'blue'}`}>
                              {e.status}
                            </span>
                          </td>
                          <td>
                            <button className="btn btn-primary btn-sm" onClick={() => setSelectedEntry(e)}>
                              Review
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No history yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Week</th>
                    <th>Status</th>
                    <th>Actioned By</th>
                    <th>Date</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 100).map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                      <td>{e.project}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{e.hours}h</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                      <td>
                        <span className={`badge badge-${e.status === 'approved' ? 'green' : 'red'}`}>{e.status}</span>
                      </td>
                      <td>{e.approvedByName || e.rejectedBy || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(e.approvedAt || e.rejectedAt)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {e.correctionNote || e.rejectionReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedEntry && (
        <ApprovalModal
          entry={selectedEntry}
          staff={staff}
          onClose={() => setSelectedEntry(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}
