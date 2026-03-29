'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate, weekRange, genId, logAudit, getWeekKey } from '../../lib/utils'
import { Staff, Entry, ApprovalDelegation, ApprovalHistoryEntry } from '../../types'
import toast from 'react-hot-toast'
import { Plus, X, CheckSquare, Square, Trash2 } from 'lucide-react'
import PageHeader from '../common/PageHeader'
import ConfirmModal from '../common/ConfirmModal'

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
            {entry.approvalHistory && entry.approvalHistory.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Previous Actions</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {entry.approvalHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(h => (
                    <div key={h.id} style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-card)', borderRadius: 4 }}>
                      <strong>{h.reviewerName}</strong> ({h.reviewerRole}) - {h.action} {h.correctedHours ? `(${h.correctedHours}h)` : ''}
                      {h.note && <span> - {h.note}</span>}
                      <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{fmtDate(h.timestamp)}</span>
                    </div>
                  ))}
                </div>
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
                <label className="form-label">Correction Note *</label>
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
            disabled={
              !action ||
              (action === 'reject' && !note.trim()) ||
              (action === 'clarify' && !note.trim()) ||
              (action === 'approve_correction' && !note.trim())
            }
            onClick={() => onAction(entry.id, action, note, correctedHours)}
          >
            Submit Decision
          </button>
        </div>
      </div>
    </div>
  )
}

interface DelegationModalProps {
  onSave: (delegation: Partial<ApprovalDelegation>) => void;
  onClose: () => void;
  taskOwners: Staff[];
  projects: any[];
}

function DelegationModal({ onSave, onClose, taskOwners, projects }: DelegationModalProps) {
  const [form, setForm] = useState({
    delegateId: '',
    startDate: '',
    endDate: '',
    reason: '',
    scope: 'all' as 'all' | 'project' | 'projects',
    projectId: '',
    projectIds: [] as string[]
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Create Approval Delegation</span>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Delegate To *</label>
            <select className="form-select" value={form.delegateId} onChange={e => setForm({ ...form, delegateId: e.target.value })}>
              <option value="">Select a team lead or admin...</option>
              {taskOwners.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Delegation Scope *</label>
            <select className="form-select" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value as 'all' | 'project' | 'projects', projectId: '', projectIds: [] })}>
              <option value="all">All Approvals</option>
              <option value="project">Single Project Only</option>
              <option value="projects">Multiple Projects</option>
            </select>
            <span className="form-hint">Choose whether to delegate all your approvals or specific projects</span>
          </div>

          {form.scope === 'project' && (
            <div className="form-group">
              <label className="form-label">Project/Task *</label>
              <select className="form-select" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
                <option value="">Select a project...</option>
                {projects.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {form.scope === 'projects' && (
            <div className="form-group">
              <label className="form-label">Projects/Tasks *</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-card)' }}>
                {projects.filter(p => p.active).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <input
                      type="checkbox"
                      id={`modal-project-${p.id}`}
                      checked={form.projectIds.includes(p.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setForm({ ...form, projectIds: [...form.projectIds, p.id] })
                        } else {
                          setForm({ ...form, projectIds: form.projectIds.filter(id => id !== p.id) })
                        }
                      }}
                    />
                    <label htmlFor={`modal-project-${p.id}`} style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>{p.name}</label>
                  </div>
                ))}
              </div>
              <span className="form-hint">{form.projectIds.length} project(s) selected</span>
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">From Date *</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Until Date *</label>
              <input className="form-input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <input className="form-input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Annual leave" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.delegateId || !form.startDate || !form.endDate || (form.scope === 'project' && !form.projectId) || (form.scope === 'projects' && form.projectIds.length === 0)}
            onClick={() => onSave(form)}
          >
            Create Delegation
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const { user, entries, staff, saveEntries, saveNotifications, notify, awardPoints, settings, approvalDelegations, saveApprovalDelegations, projects } = useApp()
  const [tab, setTab] = useState<string>('pending') // pending, history, delegations, outstanding
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterDept, setFilterDept] = useState<string>('')
  const [filterWeek, setFilterWeek] = useState<string>('')
  const [showDelegationModal, setShowDelegationModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, action: () => void, message: string, title?: string}>({isOpen: false, action: () => {}, message: ''})

  const secondLevelThreshold = (settings?.approvalWorkflow?.secondLevelThreshold as number) || 20
  const isAdmin = user?.role === 'admin'
  const normalizedUserName = (user?.name || '').trim().toLowerCase()

  // Active delegations for current user
  const now = new Date()
  const myActiveDelegations = approvalDelegations.filter(d =>
    d.taskOwnerId === user?.id &&
    d.isActive &&
    new Date(d.startDate) <= now &&
    new Date(d.endDate) >= now
  )

  // Get staff IDs this user can approve (direct reports + delegated)
  const approvableStaffIds = useMemo(() => {
    if (!user) return []
    if (isAdmin) return staff.map(s => s.id)

    const myStaff = staff.filter(s => s.leadId === user.id).map(s => s.id)
    const projectOwnedStaff = Array.from(new Set(
      entries
        .filter(e => !e.deleted && (e.leadId === user.id || (e.lead || '').trim().toLowerCase() === normalizedUserName))
        .map(e => e.staffId)
    ))

    // Add delegated staff
    const activeDelegations = approvalDelegations.filter(d =>
      d.delegateId === user.id &&
      d.isActive &&
      new Date(d.startDate) <= now &&
      new Date(d.endDate) >= now
    )

    const delegatedOwnerIds = activeDelegations.map(d => d.taskOwnerId)
    const delegatedStaff = staff.filter(s => delegatedOwnerIds.includes(s.leadId || '')).map(s => s.id)

    return Array.from(new Set([...myStaff, ...delegatedStaff, ...projectOwnedStaff]))
  }, [user, staff, approvalDelegations, isAdmin, now, entries, normalizedUserName])
  const isTaskOwner = isAdmin || user?.role === 'team_lead' || approvableStaffIds.length > 0

  // Which entries this approver can see (based on reporting lead name matching)
  const relevantEntries: Entry[] = useMemo(() => {
    if (!user) return []

    return entries.filter(e => {
      if (e.deleted) return false

      // Exclude user's own entries (prevent self-approval)
      if (e.staffId === user.id && !isAdmin) return false

      // Admin sees all entries including 2nd-level
      if (isAdmin) {
        return ['draft', 'submitted', 'resubmitted', 'pending_2nd_approval', 'pending_clarification'].includes(e.status)
      }

      // Team leads, delegates and project/task owners
      return ['draft', 'submitted', 'resubmitted', 'pending_clarification'].includes(e.status) && approvableStaffIds.includes(e.staffId)
    })
  }, [entries, user, isAdmin, approvableStaffIds])

  const pending = relevantEntries.filter(e => ['draft', 'submitted', 'resubmitted', 'pending_clarification'].includes(e.status))
  const pending2ndLevel = isAdmin ? entries.filter(e => e.status === 'pending_2nd_approval' && !e.deleted) : []
  const history = entries.filter(e => ['approved', 'rejected'].includes(e.status) && !e.deleted && (isAdmin || approvableStaffIds.includes(e.staffId)))
  const currentWeekKey = getWeekKey(new Date())
  const [secondLevelWeek, setSecondLevelWeek] = useState<string>(currentWeekKey)
  const secondLevelWeekEntries = isAdmin
    ? entries.filter(e => !e.deleted && e.weekKey === secondLevelWeek && e.hours >= secondLevelThreshold)
    : []

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

    // Validate rejection/clarification requires a note
    if ((action === 'reject' || action === 'clarify') && !note.trim()) {
      toast.error('Reason is required')
      return
    }

    // Validate correction requires a note
    if (action === 'approve_correction' && !note.trim()) {
      toast.error('Correction note is required')
      return
    }

    const now = new Date().toISOString()
    const reviewerRole: 'task_owner' | 'admin' = isAdmin ? 'admin' : 'task_owner'

    // Create approval history entry
    const historyEntry: ApprovalHistoryEntry = {
      id: genId(),
      action: action === 'approve' ? 'approved' : action === 'approve_correction' ? 'correction' : action === 'reject' ? 'rejected' : 'clarification',
      reviewerId: user.id,
      reviewerName: user.name || '',
      reviewerRole,
      timestamp: now,
      ...(note && { note }), // Only include note if it exists
      ...(action === 'approve_correction' && correctedHours !== undefined && { correctedHours })
    }

    const approvalHistory = [...(entry.approvalHistory || []), historyEntry]
    let updates: Partial<Entry> = { approvalHistory }

    switch (action) {
      case 'approve':
        // Check if 2nd-level approval is needed
        if (entry.hours >= secondLevelThreshold && !isAdmin) {
          updates = {
            ...updates,
            status: 'pending_2nd_approval' as const,
            approvedBy: user.id,
            approvedByName: user.name,
            approvedAt: now
          }
          // Notify admin for 2nd-level approval
          const admins = staff.filter(s => s.role === 'admin')
          admins.forEach(admin => {
            notify(admin.id, `⚠️ 2nd-level approval needed: ${entry.staffName} - ${entry.project} (${entry.hours}h)`, 'approval')
          })
          notify(entry.staffId, `✅ Your entry "${entry.project}" was approved by ${user.name} and is pending admin review`, 'approval')
          toast.success('Approved - escalated for 2nd-level review')
        } else {
          updates = {
            ...updates,
            status: 'approved' as const,
            approvedAt: now,
            approvedBy: user.id,
            approvedByName: user.name
          }
          // Award points to staff
          const pts = (settings?.points?.approved as number) || 5
          awardPoints(entry.staffId, pts, 'Entry approved')
          notify(entry.staffId, `✅ Your entry "${entry.project}" was approved by ${user.name}`, 'approval')
          toast.success('Entry approved')
        }
        break

      case 'approve_correction':
        // Check 2nd-level for corrected hours
        if (correctedHours >= secondLevelThreshold && !isAdmin) {
          updates = {
            ...updates,
            status: 'pending_2nd_approval' as const,
            hours: correctedHours,
            correctionNote: note,
            corrected: true,
            approvedBy: user.id,
            approvedByName: user.name,
            approvedAt: now
          }
          const admins = staff.filter(s => s.role === 'admin')
          admins.forEach(admin => {
            notify(admin.id, `⚠️ 2nd-level approval needed: ${entry.staffName} - ${entry.project} (corrected to ${correctedHours}h)`, 'approval')
          })
          notify(entry.staffId, `✏️ Entry approved with correction by ${user.name} (${correctedHours}h) and is pending admin review: ${note}`, 'approval')
          toast.success('Approved with correction - escalated for 2nd-level review')
        } else {
          updates = {
            ...updates,
            status: 'approved' as const,
            approvedAt: now,
            approvedBy: user.id,
            approvedByName: user.name,
            hours: correctedHours,
            correctionNote: note,
            corrected: true
          }
          awardPoints(entry.staffId, (settings?.points?.approved as number) || 5, 'Entry approved')
          notify(entry.staffId, `✏️ Entry approved with correction by ${user.name} (${correctedHours}h): ${note}`, 'approval')
          toast.success('Entry approved with correction')
        }
        break

      case 'reject':
        updates = {
          ...updates,
          status: 'rejected' as const,
          rejectedAt: now,
          rejectedBy: user.id,
          rejectionReason: note
        }
        notify(entry.staffId, `❌ Entry rejected by ${user.name}: ${note}`, 'rejection')
        toast.success('Entry rejected')
        break

      case 'clarify':
        updates = {
          ...updates,
          status: 'pending_clarification' as const,
          clarificationNote: note
        }
        notify(entry.staffId, `❓ Clarification needed from ${user.name}: ${note}`, 'info')
        toast.success('Clarification requested')
        break
    }

    const updated = entries.map(e => e.id === entryId ? { ...e, ...updates, updatedAt: now } : e)
    saveEntries(updated)
    logAudit(`APPROVAL_${action.toUpperCase()}`, `${user.name} ${action}d entry by ${entry.staffName}`, user.id, user.name)
    setSelectedEntry(null)
  }

  function bulkApprove(ids: string[]) {
    if (!user) return

    setConfirmAction({
      isOpen: true,
      action: () => {
        const now = new Date().toISOString()
    const reviewerRole: 'task_owner' | 'admin' = isAdmin ? 'admin' : 'task_owner'

    const updated = entries.map(e => {
      if (!ids.includes(e.id) || !['submitted', 'resubmitted'].includes(e.status)) return e

      const historyEntry: ApprovalHistoryEntry = {
        id: genId(),
        action: 'approved',
        reviewerId: user.id,
        reviewerName: user.name || '',
        reviewerRole,
        timestamp: now,
        note: 'Bulk approval'
      }

      // Check 2nd-level threshold
      if (e.hours >= secondLevelThreshold && !isAdmin) {
        notify(e.staffId, `✅ Your entry "${e.project}" was approved and is pending admin review`, 'approval')
        return {
          ...e,
          status: 'pending_2nd_approval' as const,
          approvedBy: user.id,
          approvedByName: user.name,
          approvedAt: now,
          approvalHistory: [...(e.approvalHistory || []), historyEntry],
          updatedAt: now
        }
      }

      notify(e.staffId, `✅ Entry "${e.project}" was approved`, 'approval')
      awardPoints(e.staffId, (settings?.points?.approved as number) || 5, 'Entry approved')
      return {
        ...e,
        status: 'approved' as const,
        approvedAt: now,
        approvedBy: user.id,
        approvedByName: user.name,
        approvalHistory: [...(e.approvalHistory || []), historyEntry],
        updatedAt: now
      }
    })

    saveEntries(updated)

    // Notify admins if 2nd-level approvals were created
    const escalated = updated.filter(e => ids.includes(e.id) && e.status === 'pending_2nd_approval').length
    if (escalated > 0) {
      const admins = staff.filter(s => s.role === 'admin')
      admins.forEach(admin => {
        notify(admin.id, `⚠️ ${escalated} entries require 2nd-level approval`, 'approval')
      })
      toast.success(`${ids.length - escalated} approved, ${escalated} escalated for 2nd-level review`)
        } else {
          toast.success(`${ids.length} entries approved`)
        }
      },
      message: `Approve ${ids.length} entries?`,
      title: 'Bulk Approve'
    })
  }

  function createDelegation(form: Partial<ApprovalDelegation>) {
    if (!user || !form.delegateId || !form.startDate || !form.endDate) return

    const delegate = staff.find(s => s.id === form.delegateId)
    if (!delegate) return

    let projectName = undefined
    let projectNames: string[] = []

    if (form.scope === 'project' && form.projectId && projects) {
      const project = projects.find((p: any) => p.id === form.projectId)
      projectName = project?.name
    }

    if (form.scope === 'projects' && form.projectIds && form.projectIds.length > 0 && projects) {
      projectNames = form.projectIds.map(id => {
        const project = projects.find((p: any) => p.id === id)
        return project?.name || ''
      }).filter(Boolean)
    }

    const delegation: ApprovalDelegation = {
      id: genId(),
      taskOwnerId: user.id,
      taskOwnerName: user.name || '',
      delegateId: form.delegateId,
      delegateName: delegate.name,
      startDate: form.startDate,
      endDate: form.endDate,
      isActive: true,
      createdAt: new Date().toISOString(),
      reason: form.reason,
      scope: form.scope || 'all',
      projectId: form.projectId,
      projectName,
      projectIds: form.scope === 'projects' ? form.projectIds : undefined,
      projectNames: form.scope === 'projects' ? projectNames : undefined
    }

    saveApprovalDelegations([...approvalDelegations, delegation])

    let scopeText = ''
    if (form.scope === 'project' && projectName) {
      scopeText = ` for ${projectName}`
    } else if (form.scope === 'projects' && projectNames.length > 0) {
      scopeText = ` for ${projectNames.length} project${projectNames.length > 1 ? 's' : ''}: ${projectNames.join(', ')}`
    }

    notify(form.delegateId, `📋 ${user.name} has delegated approval duties${scopeText} to you from ${form.startDate} to ${form.endDate}`, 'delegation_assigned', 'Delegation Assigned', delegation.id, 'message')
    toast.success('Delegation created')
    setShowDelegationModal(false)
  }

  function revokeDelegation(id: string) {
    setConfirmAction({
      isOpen: true,
      action: () => {
        const updated = approvalDelegations.map(d =>
          d.id === id ? { ...d, isActive: false, revokedAt: new Date().toISOString() } : d
        )
        saveApprovalDelegations(updated)
        toast.success('Delegation revoked')
      },
      message: 'Revoke this delegation?',
      title: 'Revoke Delegation'
    })
  }

  const displayPending = getFilteredPending()
  const taskOwners = staff.filter(s => s.status === 'active' && !s.suspended && s.id !== user?.id)

  function handleBulkApprove() {
    if (selectedIds.length === 0) return

    setConfirmAction({
      isOpen: true,
      action: () => {
        const now = new Date().toISOString()
        const approvableStatuses = new Set(['submitted', 'resubmitted', 'pending_clarification'])
        const updatedEntries = entries.map(e => {
          if (selectedIds.includes(e.id) && approvableStatuses.has(e.status)) {
            const history: ApprovalHistoryEntry = {
              id: genId(),
              reviewerId: user?.id || '',
              reviewerName: user?.name || '',
              reviewerRole: user?.role || '',
              action: 'approved',
              timestamp: now
            }

            // Award points
            awardPoints(e.staffId, 5, 'Submission Approved', e.weekKey)

            // Notify
            notify(e.staffId, `Your timesheet for ${e.project} has been approved`, 'approval', 'Timesheet Approved', e.id, 'entry')

            return {
              ...e,
              status: 'approved',
              approvedBy: user?.id,
              approvedAt: now,
              approvalHistory: [...(e.approvalHistory || []), history]
            }
          }
          return e
        })

        saveEntries(updatedEntries as Entry[])
        setSelectedIds([])
        toast.success(`Successfully approved ${selectedIds.length} entries`)
      },
      message: `Are you sure you want to approve ${selectedIds.length} entries?`,
      title: 'Bulk Approve Timesheets'
    })
  }

  function handleBulkReject() {
    if (selectedIds.length === 0) return

    setConfirmAction({
      isOpen: true,
      action: () => {
        const now = new Date().toISOString()
        const rejectableStatuses = new Set(['submitted', 'resubmitted', 'draft', 'pending_clarification'])
        const updatedEntries = entries.map(e => {
          if (selectedIds.includes(e.id) && rejectableStatuses.has(e.status)) {
            const history: ApprovalHistoryEntry = {
              id: genId(),
              reviewerId: user?.id || '',
              reviewerName: user?.name || '',
              reviewerRole: user?.role || '',
              action: 'rejected',
              timestamp: now,
              note: 'Bulk rejected'
            }
            notify(e.staffId, `Your timesheet for ${e.project} was rejected`, 'rejection', 'Timesheet Rejected', e.id, 'entry')
            return {
              ...e,
              status: 'rejected',
              rejectedBy: user?.id,
              rejectedAt: now,
              rejectionReason: 'Bulk rejected',
              approvalHistory: [...(e.approvalHistory || []), history]
            }
          }
          return e
        })

        saveEntries(updatedEntries as Entry[])
        setSelectedIds([])
        toast.success(`Rejected ${selectedIds.length} entries`)
      },
      message: `Reject ${selectedIds.length} selected entries? Staff will be notified.`,
      title: 'Bulk Reject Timesheets'
    })
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) return

    setConfirmAction({
      isOpen: true,
      action: () => {
        const now = new Date().toISOString()
        const updated = entries.map(e =>
          selectedIds.includes(e.id) ? { ...e, deleted: true, deletedAt: now } : e
        )
        saveEntries(updated)
        setSelectedIds([])
        toast.success(`Deleted ${selectedIds.length} entries`)
      },
      message: `Permanently delete ${selectedIds.length} selected entries?`,
      title: 'Bulk Delete Entries'
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Approvals"
        icon="✅"
        subtitle={`${displayPending.length} entries pending your review`}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {selectedIds.length > 0 && (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{selectedIds.length} selected</span>
                <button className="btn btn-success btn-sm" onClick={handleBulkApprove}>
                  Approve Selected
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleBulkReject}>
                  Reject Selected
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleBulkDelete}>
                  Delete Selected
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>Clear</button>
              </>
            )}
            <div className="btn-secondary btn" style={{ opacity: 0.7, cursor: 'default' }}>
              Pending: {displayPending.length}
            </div>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: pending.length > 0 ? 'var(--warning)' : 'var(--success)' }}>{pending.length}</div>
          <div className="stat-sub">{pending.length > 0 ? 'Requires action' : 'All caught up!'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{isAdmin ? '2nd-Level Review' : 'Approved (All time)'}</div>
          <div className="stat-value" style={{ color: isAdmin ? (pending2ndLevel.length > 0 ? 'var(--warning)' : 'var(--text-3)') : 'var(--success)' }}>
            {isAdmin ? pending2ndLevel.length : history.filter(e => e.status === 'approved').length}
          </div>
          <div className="stat-sub">{isAdmin ? 'High-value entries' : ''}</div>
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

      {/* Delegations Banner */}
      {myActiveDelegations.length > 0 && (
        <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
            📋 Active Delegations ({myActiveDelegations.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {myActiveDelegations.map(d => (
              <div key={d.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  Delegated to <strong>{d.delegateName}</strong> ({fmtDate(d.startDate)} - {fmtDate(d.endDate)})
                  {d.reason && <span style={{ color: 'var(--text-3)' }}> - {d.reason}</span>}
                </span>
                <button className="btn btn-danger btn-sm" onClick={() => revokeDelegation(d.id)}>Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>Pending ({displayPending.length})</button>
        {isAdmin && <button className={`tab ${tab === 'outstanding' ? 'active' : ''}`} onClick={() => setTab('outstanding')}>Outstanding</button>}
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        {isAdmin && <button className={`tab ${tab === '2nd_level' ? 'active' : ''}`} onClick={() => setTab('2nd_level')}>2nd-Level Review ({secondLevelWeekEntries.filter(e => e.status === 'pending_2nd_approval').length})</button>}
        {isTaskOwner && <button className={`tab ${tab === 'delegations' ? 'active' : ''}`} onClick={() => setTab('delegations')}>Delegations</button>}
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
                      <th style={{ width: 40 }}>
                        <button
                          className="btn btn-icon btn-secondary btn-sm"
                          onClick={() => {
                            const selectableIds = displayPending
                              .filter(e => ['submitted', 'resubmitted', 'pending_clarification'].includes(e.status))
                              .map(e => e.id)
                            if (selectedIds.length === selectableIds.length) setSelectedIds([])
                            else setSelectedIds(selectableIds)
                          }}
                        >
                          {selectedIds.length > 0 && selectedIds.length === displayPending.filter(e => ['submitted', 'resubmitted', 'pending_clarification'].includes(e.status)).length ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </th>
                      <th>Staff</th>
                      <th>Dept</th>
                      <th>Project</th>
                      <th>Lead</th>
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
                        <tr key={e.id} style={{ background: e.status === 'pending_clarification' ? 'rgba(245,158,11,0.05)' : undefined }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(e.id)}
                              disabled={e.status === 'draft'}
                              onChange={() => {
                                if (selectedIds.includes(e.id)) {
                                  setSelectedIds(selectedIds.filter(id => id !== e.id))
                                } else {
                                  setSelectedIds([...selectedIds, e.id])
                                }
                              }}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                          <td style={{ color: 'var(--text-3)' }}>{s?.department || '—'}</td>
                          <td>{e.project}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: 13 }}>{e.lead || '—'}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(e.date)}</td>
                          <td style={{ fontWeight: 700 }}>
                            {e.hours}h
                            {needsSecondLevel && !isAdmin && <span title={`Will trigger 2nd-level approval (threshold: ${secondLevelThreshold}h)`} style={{ marginLeft: 4, fontSize: 14 }}>⚠️</span>}
                          </td>
                          <td><span className="badge badge-blue">{e.category}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                          <td>
                            <span className={`badge badge-${e.status === 'draft' ? 'gray' : e.status === 'resubmitted' ? 'yellow' : e.status === 'pending_clarification' ? 'yellow' : 'blue'}`}>
                              {e.status === 'pending_clarification' ? 'clarification' : e.status === 'draft' ? 'planned' : e.status}
                            </span>
                          </td>
                          <td>
                            {e.status === 'draft' ? (
                              <span className="badge badge-gray">Awaiting Submit</span>
                            ) : (
                              <button className="btn btn-primary btn-sm" onClick={() => setSelectedEntry(e)}>
                                Review
                              </button>
                            )}
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

      {tab === '2nd_level' && isAdmin && (
        <>
          <div className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Week in view: <strong>{weekRange(secondLevelWeek)}</strong>
            </div>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={secondLevelWeek}
              onChange={e => setSecondLevelWeek(e.target.value)}
            >
              {weeks.map(w => (
                <option key={w} value={w}>{weekRange(w)}</option>
              ))}
            </select>
          </div>

          {secondLevelWeekEntries.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No 2nd-level items this week</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Project</th>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Week</th>
                      <th>1st Approver</th>
                      <th>Review Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secondLevelWeekEntries.map(e => {
                      const reviewStatus = e.status === 'pending_2nd_approval' ? 'Pending Admin Review' : e.status === 'approved' ? 'Approved' : e.status === 'rejected' ? 'Rejected' : 'In Review'
                      const badge = e.status === 'pending_2nd_approval' ? 'yellow' : e.status === 'approved' ? 'green' : e.status === 'rejected' ? 'red' : 'gray'
                      return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                        <td>{e.project}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(e.date)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--warning)' }}>{e.hours}h</td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                        <td style={{ fontSize: 12 }}>{e.approvedByName || '—'}</td>
                        <td>
                          <span className={`badge badge-${badge}`}>{reviewStatus}</span>
                        </td>
                        <td>
                          {e.status === 'pending_2nd_approval' ? (
                            <button className="btn btn-primary btn-sm" onClick={() => setSelectedEntry(e)}>
                              Review
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'outstanding' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>⚠️ Outstanding Submissions</h3>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Current Week: <strong>{weekRange(new Date().toISOString().split('T')[0])}</strong></div>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter(s => !entries.some(e => e.staffId === s.id && e.weekKey === (new Date().toISOString().split('T')[0]) && !e.deleted))
                  .filter(s => !filterDept || s.department === filterDept)
                  .filter(s => !s.exemptFromTimesheet)
                  .map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.department || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{s.role?.replace('_', ' ')}</td>
                      <td style={{ color: 'var(--text-3)' }}>{s.email}</td>
                      <td><span className="badge badge-gray">Not Submitted</span></td>
                    </tr>
                ))}
                {staff.filter(s => !entries.some(e => e.staffId === s.id && e.weekKey === (new Date().toISOString().split('T')[0]) && !e.deleted)).filter(s => !filterDept || s.department === filterDept).filter(s => !s.exemptFromTimesheet).length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-3)' }}>
                      🎉 Everyone has submitted!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                  {history.sort((a, b) => new Date(b.approvedAt || b.rejectedAt || b.updatedAt || '').getTime() - new Date(a.approvedAt || a.rejectedAt || a.updatedAt || '').getTime()).slice(0, 100).map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                      <td>{e.project}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>
                        {e.hours}h
                        {e.corrected && <span title="Hours were corrected" style={{ marginLeft: 4, color: 'var(--warning)' }}>✏️</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                      <td>
                        <span className={`badge badge-${e.status === 'approved' ? 'green' : 'red'}`}>{e.status}</span>
                      </td>
                      <td>{e.approvedByName || e.rejectedBy || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(e.approvedAt || e.rejectedAt || '')}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.correctionNote || e.rejectionReason || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'delegations' && isTaskOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Delegate your approval duties to another Task Owner while you're away
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowDelegationModal(true)}>
              <Plus size={14} /> Create Delegation
            </button>
          </div>

          {approvalDelegations.filter(d => d.taskOwnerId === user?.id).length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No delegations yet</div>
              <div className="empty-state-desc">Create a delegation to assign approval duties to another Task Owner</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Delegate</th>
                      <th>Scope</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalDelegations
                      .filter(d => d.taskOwnerId === user?.id)
                      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                      .map(d => {
                        const isActive = d.isActive && new Date(d.startDate) <= now && new Date(d.endDate) >= now
                        const isFuture = new Date(d.startDate) > now
                        const isPast = new Date(d.endDate) < now

                        return (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600 }}>{d.delegateName}</td>
                            <td style={{ fontSize: 12 }}>
                              {d.scope === 'project' && d.projectName ? (
                                <span className="badge badge-blue">{d.projectName}</span>
                              ) : d.scope === 'projects' && d.projectNames && d.projectNames.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span className="badge badge-blue">{d.projectNames.length} projects</span>
                                  <span style={{ fontSize: 10, color: 'var(--text-3)' }} title={d.projectNames.join(', ')}>
                                    {d.projectNames.slice(0, 2).join(', ')}{d.projectNames.length > 2 ? ` +${d.projectNames.length - 2}` : ''}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-3)' }}>All Approvals</span>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>{fmtDate(d.startDate)}</td>
                            <td style={{ fontSize: 12 }}>{fmtDate(d.endDate)}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{d.reason || '—'}</td>
                            <td>
                              <span className={`badge badge-${isActive ? 'green' : isFuture ? 'blue' : 'gray'}`}>
                                {isActive ? 'Active' : isFuture ? 'Scheduled' : isPast ? 'Expired' : 'Revoked'}
                              </span>
                            </td>
                            <td>
                              {(isActive || isFuture) && (
                                <button className="btn btn-danger btn-sm" onClick={() => revokeDelegation(d.id)}>
                                  Revoke
                                </button>
                              )}
                            </td>
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

      {selectedEntry && (
        <ApprovalModal
          entry={selectedEntry}
          staff={staff}
          onClose={() => setSelectedEntry(null)}
          onAction={handleAction}
        />
      )}

      {showDelegationModal && (
        <DelegationModal
          onSave={createDelegation}
          onClose={() => setShowDelegationModal(false)}
          taskOwners={taskOwners}
          projects={projects || []}
        />
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.action}
        onCancel={() => setConfirmAction({isOpen: false, action: () => {}, message: ''})}
      />
    </div>
  )
}
