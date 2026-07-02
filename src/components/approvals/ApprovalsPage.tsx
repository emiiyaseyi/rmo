'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate, fmtDateTime, weekRange, genId, logAudit, getWeekKey, formatTimeUntilDeadline, getSubmissionWindowStatus, sendEmailNotification, exportCSV, exportPDF, avatarColor, initials } from '../../lib/utils'
import { Staff, Entry, ApprovalHistoryEntry } from '../../types'
import toast from 'react-hot-toast'
import { X, CheckSquare, Square, Trash2, Check, Search } from 'lucide-react'
import PageHeader from '../common/PageHeader'
import ConfirmModal from '../common/ConfirmModal'

interface ApprovalModalProps {
  entry: Entry;
  staff: Staff[];
  onClose: () => void;
  onAction: (entryId: string, action: string, note: string, correctedHours: number, notNewTask?: boolean) => void;
}

function ApprovalModal({ entry, staff, onClose, onAction }: ApprovalModalProps) {
  const [action, setAction] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [correctedHours, setCorrectedHours] = useState<number>(entry.hours)
  const [notNewTask, setNotNewTask] = useState(false)

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

          {/* New task override toggle */}
          {entry.isNewTask && (
            <div style={{
              background: notNewTask ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
              border: `1px solid ${notNewTask ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
              borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: notNewTask ? 'var(--danger)' : 'var(--warning)' }}>
                  🆕 Flagged as New Task (no late penalty)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {notNewTask ? 'Will be treated as a late submission — points will be deducted.' : 'Staff submitted this outside the window as a new task.'}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={notNewTask}
                  onChange={e => setNotNewTask(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
                Not a new task
              </label>
            </div>
          )}

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
            onClick={() => onAction(entry.id, action, note, correctedHours, notNewTask)}
          >
            Submit Decision
          </button>
        </div>
      </div>
    </div>
  )
}

function MultiSelectDropdown({
  label, filterKey, items, selected, onToggle, onToggleAll, countMap,
}: {
  label: string
  filterKey: string
  items: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onToggleAll: () => void
  countMap?: Record<string, number>
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const allSelected = selected.length === items.length
  const summary = selected.length === 0 || allSelected ? `All ${label}` : `${selected.length} selected`

  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="form-group" style={{ margin: 0, position: 'relative' }}>
      <label className="form-label">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--bg-input, var(--bg-elevated))', fontSize: 13, cursor: 'pointer',
          color: selected.length === 0 || allSelected ? 'var(--text-3)' : 'var(--text-1)',
        }}
      >
        <span>{summary}</span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{selected.length} of {items.length} selected</span>
            <button
              type="button"
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={onToggleAll}
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
            {items.map(item => (
              <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.value)}
                  onChange={() => onToggle(item.value)}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ flex: 1, color: selected.includes(item.value) ? 'var(--text-1)' : 'var(--text-2)' }}>{item.label}</span>
                {countMap && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{countMap[item.value] ?? 0}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApprovalsPage() {
  const { user, entries, staff, saveEntries, saveNotifications, notify, awardPoints, settings, pendingApprovals } = useApp()
  const [tab, setTab] = useState<string>('pending') // pending, history, outstanding
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterDept, setFilterDept] = useState<string>('')
  const [filterWeek, setFilterWeek] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, action: () => void, message: string, title?: string}>({isOpen: false, action: () => {}, message: ''})
  const [reviewTimeLeft, setReviewTimeLeft] = useState('')
  const [historyEntry, setHistoryEntry] = useState<Entry | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [exportFilters, setExportFilters] = useState<{ statuses: string[], departments: string[], weeks: string[] }>({ statuses: [], departments: [], weeks: [] })
  const [exporting, setExporting] = useState(false)

  // Compute review window directly from settings — no DB needed
  const reviewWindowInfo = useMemo(() => {
    if (settings?.reviewWindow?.enabled === false) return null
    const ws = getSubmissionWindowStatus(settings?.submissionWindow)
    if (!ws.deadline) return null
    const hours = settings?.reviewWindow?.hoursAfterClose ?? 24
    const reviewDeadline = new Date(ws.deadline.getTime() + hours * 60 * 60 * 1000)
    const now = new Date()
    // Show banner only when submission window is past (review window is active or just expired)
    if (!ws.isPastDeadline) return null
    return { reviewDeadline, isOverdue: now > reviewDeadline }
  }, [settings?.submissionWindow])

  useEffect(() => {
    if (!reviewWindowInfo?.reviewDeadline) return
    const tick = () => setReviewTimeLeft(formatTimeUntilDeadline(reviewWindowInfo.reviewDeadline))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [reviewWindowInfo?.reviewDeadline])

  const secondLevelThreshold = (settings?.approvalWorkflow?.secondLevelThreshold as number) || 20
  const isAdmin = user?.role === 'admin'
  const normalizedUserName = (user?.name || '').trim().toLowerCase()

  // Get staff IDs this user can approve (direct reports + project-owned)
  const approvableStaffIds = useMemo(() => {
    if (!user) return []
    if (isAdmin) return staff.map(s => s.id)

    const myStaff = staff.filter(s => s.leadId === user.id).map(s => s.id)
    const projectOwnedStaff = Array.from(new Set(
      entries
        .filter(e => !e.deleted && (e.leadId === user.id || (e.lead || '').trim().toLowerCase() === normalizedUserName))
        .map(e => e.staffId)
    ))

    return Array.from(new Set([...myStaff, ...projectOwnedStaff]))
  }, [user, staff, isAdmin, entries, normalizedUserName])

  // Use the shared pendingApprovals() from context — same source as dashboard badge and menu count
  const pending = pendingApprovals()
  const pending2ndLevel = isAdmin ? entries.filter(e => e.status === 'pending_2nd_approval' && !e.deleted) : []
  const history = entries.filter(e => ['approved', 'rejected'].includes(e.status) && !e.deleted && (isAdmin || approvableStaffIds.includes(e.staffId)))
  const currentWeekKey = getWeekKey(new Date())
  const [secondLevelWeek, setSecondLevelWeek] = useState<string>(currentWeekKey)
  const secondLevelWeekEntries = isAdmin
    ? entries.filter(e => !e.deleted && e.weekKey === secondLevelWeek && (e.hours >= secondLevelThreshold || e.isNewTask))
    : []

  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean).map(d => d as string)))
  const weeks = Array.from(new Set(pending.map(e => e.weekKey))).sort().reverse()

  function getFilteredPending(): Entry[] {
    return pending
      .filter(e => {
        const s = staff.find(m => m.id === e.staffId)
        if (filterDept && s?.department !== filterDept) return false
        if (filterWeek && e.weekKey !== filterWeek) return false
        const q = searchQuery.trim().toLowerCase()
        const reviewerName = e.lead || staff.find(x => x.id === e.leadId)?.name || ''
        const matchSearch = !q ||
          (e.staffName || '').toLowerCase().includes(q) ||
          (e.project || '').toLowerCase().includes(q) ||
          (s?.department || '').toLowerCase().includes(q) ||
          reviewerName.toLowerCase().includes(q)
        if (!matchSearch) return false
        return true
      })
      .sort((a, b) => new Date(b.submittedAt || b.createdAt || '').getTime() - new Date(a.submittedAt || a.createdAt || '').getTime())
  }

  function handleAction(entryId: string, action: string, note: string, correctedHours: number, notNewTask?: boolean) {
    if (!user) return
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return
    // A team lead cannot review their own submissions
    if (!isAdmin && entry.staffId === user.id) {
      toast.error('You cannot review your own submissions')
      return
    }

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
    let updates: Partial<Entry> = { approvalHistory, ...(notNewTask && entry.isNewTask ? { isNewTask: false } : {}) }

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
          notify(entry.staffId, `✏️ Entry approved with correction by ${user.name} (${correctedHours}h): ${note}`, 'approval')
          toast.success('Entry approved with correction')
        }
        break

      case 'reject': {
        updates = {
          ...updates,
          status: 'rejected' as const,
          rejectedAt: now,
          rejectedBy: user.id,
          rejectedByName: user.name,
          rejectionReason: note
        }
        notify(entry.staffId, `❌ Entry rejected by ${user.name}: ${note}`, 'rejection')
        const staffMemberReject = staff.find(s => s.id === entry.staffId)
        if (staffMemberReject?.email) {
          sendEmailNotification(
            staffMemberReject.email,
            `Your timesheet entry was rejected`,
            `Your entry for "${entry.project}" (${entry.hours}h, week of ${weekRange(entry.weekKey)}) was rejected by ${user.name}.\n\nReason: ${note}\n\nPlease review and resubmit if needed.`,
            '/timesheet'
          )
        }
        toast.success('Entry rejected')
        break
      }

      case 'clarify': {
        updates = {
          ...updates,
          status: 'pending_clarification' as const,
          clarificationNote: note
        }
        notify(entry.staffId, `❓ Clarification needed from ${user.name}: ${note}`, 'info')
        const staffMemberClarify = staff.find(s => s.id === entry.staffId)
        if (staffMemberClarify?.email) {
          sendEmailNotification(
            staffMemberClarify.email,
            `Clarification needed on your timesheet entry`,
            `${user.name} has requested clarification on your entry for "${entry.project}" (${entry.hours}h, week of ${weekRange(entry.weekKey)}).\n\nRequest: ${note}\n\nPlease update your entry and resubmit.`,
            '/timesheet'
          )
        }
        toast.success('Clarification requested')
        break
      }
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

  const displayPending = getFilteredPending()

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

  // Derived metrics for stat row
  const startOfWeek = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const m = new Date(d.setDate(diff))
    m.setHours(0, 0, 0, 0)
    return m
  }, [])
  const approvedThisWeek = useMemo(
    () => history.filter(e => e.status === 'approved' && e.approvedAt && new Date(e.approvedAt) >= startOfWeek).length,
    [history, startOfWeek]
  )
  const flaggedCount = useMemo(
    () => pending.filter(e => e.hours >= secondLevelThreshold || e.isNewTask).length,
    [pending, secondLevelThreshold]
  )
  const pendingHours = useMemo(
    () => pending.reduce((sum, e) => sum + (e.hours || 0), 0),
    [pending]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sora)' }}>
      {reviewWindowInfo && (
        <div style={{
          background: reviewWindowInfo.isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${reviewWindowInfo.isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
          borderRadius: 12, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>{reviewWindowInfo.isOverdue ? '🔴' : '⏰'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: reviewWindowInfo.isOverdue ? 'var(--danger)' : 'var(--warning)' }}>
              {reviewWindowInfo.isOverdue ? 'Review window has closed — penalties being applied' : 'Review window is open'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              {reviewWindowInfo.isOverdue
                ? `Deadline was ${reviewWindowInfo.reviewDeadline.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Unreviewed entries will incur a ${Math.abs(settings?.reviewWindow?.penaltyPerEntry ?? 5)}-point deduction each.`
                : `You have ${reviewTimeLeft} to review all submitted timesheets before the ${Math.abs(settings?.reviewWindow?.penaltyPerEntry ?? 5)}-point-per-entry late penalty applies.`
              }
            </div>
          </div>
        </div>
      )}

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

      {/* Stat row */}
      {(() => {
        const cardStyle: React.CSSProperties = {
          flex: 1, minWidth: 180, background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)', padding: 18, boxShadow: 'var(--sh-sm)',
        }
        const labelStyle: React.CSSProperties = {
          fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)',
        }
        const numStyle = (color: string): React.CSSProperties => ({
          fontFamily: 'var(--font-sora)', fontSize: 28, fontWeight: 700, color, marginTop: 8, lineHeight: 1,
        })
        const cards = [
          { label: 'Awaiting you', value: pending.length, color: pending.length > 0 ? 'var(--warn)' : 'var(--brand)' },
          { label: 'Flagged / high-value', value: flaggedCount, color: flaggedCount > 0 ? 'var(--danger)' : 'var(--ink-3)' },
          { label: 'Approved this week', value: approvedThisWeek, color: 'var(--brand)' },
          { label: 'Pending hours', value: `${pendingHours}h`, color: 'var(--ink)' },
        ]
        return (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {cards.map(c => (
              <div key={c.label} style={cardStyle}>
                <div style={labelStyle}>{c.label}</div>
                <div style={numStyle(c.color)}>{c.value}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Tabs */}
      {(() => {
        const tabs: { key: string; label: string }[] = [
          { key: 'pending', label: `Pending (${displayPending.length})` },
          ...(isAdmin ? [{ key: 'outstanding', label: 'Outstanding' }] : []),
          { key: 'history', label: 'History' },
          ...(isAdmin ? [{ key: '2nd_level', label: `2nd-Level Review (${secondLevelWeekEntries.filter(e => e.status === 'pending_2nd_approval').length})` }] : []),
          ...(isAdmin ? [{ key: 'export', label: 'Export' }] : []),
        ]
        return (
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)' }}>
            {tabs.map(t => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    appearance: 'none', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 14px', fontSize: 13.5, fontWeight: active ? 700 : 600,
                    fontFamily: 'var(--font-sora)', color: active ? 'var(--brand)' : 'var(--ink-3)',
                    borderBottom: `2px solid ${active ? 'var(--brand)' : 'transparent'}`,
                    marginBottom: -1, transition: 'color .15s',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        )
      })()}

      {tab === 'pending' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
          {/* Queue header: title + filter controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginRight: 'auto' }}>Approval queue</div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--ink-3)', pointerEvents: 'none' }} />
              <input
                placeholder="Search name, project, reviewer, or department..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  height: 38, minWidth: 240, paddingLeft: 34, paddingRight: 12,
                  border: '1px solid var(--line)', borderRadius: 999, background: 'var(--elev)',
                  color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sora)',
                }}
              />
            </div>

            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              style={{ height: 38, padding: '0 14px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--elev)', color: 'var(--ink)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sora)' }}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select
              value={filterWeek}
              onChange={e => setFilterWeek(e.target.value)}
              style={{ height: 38, padding: '0 14px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--elev)', color: 'var(--ink)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sora)' }}
            >
              <option value="">All Weeks</option>
              {weeks.map(w => <option key={w} value={w}>{weekRange(w)}</option>)}
            </select>

            {displayPending.length > 0 && (
              <button
                onClick={() => bulkApprove(displayPending.map(e => e.id))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sora)' }}
              >
                <Check size={15} /> Approve all ({displayPending.length})
              </button>
            )}
          </div>

          {displayPending.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No pending approvals</div>
              <div className="empty-state-desc">All submissions have been reviewed</div>
            </div>
          ) : (
            <div>
              {displayPending.map(e => {
                const s = staff.find(m => m.id === e.staffId)
                const needsSecondLevel = e.hours >= secondLevelThreshold
                const isFlagged = needsSecondLevel || e.isNewTask
                const isDraft = e.status === 'draft'
                const checkable = ['submitted', 'resubmitted', 'pending_clarification'].includes(e.status)
                const selected = selectedIds.includes(e.id)
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                      borderBottom: '1px solid var(--line-2)',
                      background: selected ? 'var(--tint)' : e.status === 'pending_clarification' ? 'var(--warn-tint)' : 'transparent',
                    }}
                  >
                    {/* select checkbox */}
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!checkable}
                      onChange={() => {
                        if (selected) setSelectedIds(selectedIds.filter(id => id !== e.id))
                        else setSelectedIds([...selectedIds, e.id])
                      }}
                      style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: checkable ? 'pointer' : 'default', flexShrink: 0 }}
                    />

                    {/* avatar */}
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: avatarColor(e.staffName || ''), color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials(e.staffName || '')}
                    </div>

                    {/* name + dept */}
                    <div style={{ width: 180, flexShrink: 0, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.staffName}</div>
                      <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{s?.department || '—'}</div>
                    </div>

                    {/* project + description + week/submitted-time */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.project}</div>
                      {e.description && (
                        <div style={{ color: 'var(--ink-2)', fontSize: 12, whiteSpace: 'normal', overflowWrap: 'anywhere', margin: '2px 0' }}>{e.description}</div>
                      )}
                      <div style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
                        {weekRange(e.weekKey)}
                        {e.submittedAt && <span> · submitted {fmtDateTime(e.submittedAt)}</span>}
                      </div>
                    </div>

                    {/* project lead / reviewer */}
                    {(() => {
                      const leadName = e.lead || staff.find(x => x.id === e.leadId)?.name || '—'
                      return (
                        <div style={{ width: 150, flexShrink: 0, minWidth: 0 }} title={leadName}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Reviewer</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leadName}</div>
                        </div>
                      )
                    })()}

                    {/* flag pill */}
                    {isFlagged && (
                      <span
                        title={e.isNewTask ? 'New task (no late penalty)' : `Will trigger 2nd-level approval (threshold: ${secondLevelThreshold}h)`}
                        style={{ fontSize: 11, fontWeight: 700, color: e.isNewTask ? 'var(--brand-2)' : 'var(--danger)', background: e.isNewTask ? 'var(--tint)' : 'var(--danger-tint)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {e.isNewTask ? 'New task' : 'High value'}
                      </span>
                    )}

                    {/* status pill for clarification/resubmitted/draft */}
                    {e.status !== 'submitted' && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--elev)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'capitalize' }}>
                        {e.status === 'pending_clarification' ? 'clarification' : e.status === 'draft' ? 'planned' : e.status}
                      </span>
                    )}

                    {/* hours */}
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', width: 56, textAlign: 'right', flexShrink: 0 }}>
                      {e.hours}h
                    </div>

                    {/* actions */}
                    {isDraft ? (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>Awaiting submit</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => setSelectedEntry(e)}
                          style={{ height: 34, padding: '0 12px', background: 'var(--elev)', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-sora)' }}
                        >
                          Review
                        </button>
                        <button
                          title="Approve"
                          onClick={() => handleAction(e.id, 'approve', '', e.hours)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: 'var(--tint)', color: 'var(--brand-2)', border: 'none', borderRadius: 'var(--r-sm)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-sora)', transition: 'background .15s, color .15s' }}
                          onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--brand)'; ev.currentTarget.style.color = '#fff' }}
                          onMouseLeave={ev => { ev.currentTarget.style.background = 'var(--tint)'; ev.currentTarget.style.color = 'var(--brand-2)' }}
                        >
                          <Check size={15} /> Approve
                        </button>
                        <button
                          title="Reject"
                          onClick={() => setSelectedEntry(e)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'var(--surface)', color: 'var(--danger)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', cursor: 'pointer', transition: 'background .15s' }}
                          onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--danger-tint)' }}
                          onMouseLeave={ev => { ev.currentTarget.style.background = 'var(--surface)' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
                      <th>Type</th>
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
                        <td>
                          {e.isNewTask
                            ? <span className="badge badge-green" title="Submitted outside window as a new task — no late penalty">🆕 New Task</span>
                            : <span className="badge badge-yellow" title="High-value entry requiring 2nd-level review">⚠️ High Value</span>
                          }
                        </td>
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
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Current Week: <strong>{weekRange(currentWeekKey)}</strong></div>
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

      {tab === 'history' && (() => {
        const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--elev, var(--bg-card))' }
        // Resolve the person who actioned each entry to a display name (old rows stored only an id)
        const actionedByName = (e: Entry) =>
          e.approvedByName || e.rejectedByName ||
          staff.find(s => s.id === (e.rejectedBy || e.approvedBy))?.name || '—'
        const q = historySearch.trim().toLowerCase()
        const fromMs = historyFrom ? new Date(historyFrom + 'T00:00:00').getTime() : null
        const toMs = historyTo ? new Date(historyTo + 'T23:59:59').getTime() : null
        const filteredHistory = history
          .filter(e => {
            if (q) {
              const hay = `${e.staffName || ''} ${e.project || ''} ${actionedByName(e)}`.toLowerCase()
              if (!hay.includes(q)) return false
            }
            const actionMs = new Date(e.approvedAt || e.rejectedAt || e.updatedAt || '').getTime()
            if (fromMs !== null && (isNaN(actionMs) || actionMs < fromMs)) return false
            if (toMs !== null && (isNaN(actionMs) || actionMs > toMs)) return false
            return true
          })
          .sort((a, b) => new Date(b.approvedAt || b.rejectedAt || b.updatedAt || '').getTime() - new Date(a.approvedAt || a.rejectedAt || a.updatedAt || '').getTime())
        return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* caption — makes it clear this is the record of past actions */}
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>History of past approvals</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Approved & rejected entries you've actioned. {filteredHistory.length} shown.</div>
          </div>
          {/* filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: 12, borderBottom: '1px solid var(--line-2)' }}>
            <input
              className="form-input"
              placeholder="Search staff, project or reviewer…"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              From <input type="date" className="form-input" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} style={{ width: 'auto' }} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              To <input type="date" className="form-input" value={historyTo} onChange={e => setHistoryTo(e.target.value)} style={{ width: 'auto' }} />
            </label>
            {(historySearch || historyFrom || historyTo) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setHistorySearch(''); setHistoryFrom(''); setHistoryTo('') }}>Clear</button>
            )}
          </div>
          {filteredHistory.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">{history.length === 0 ? 'No history yet' : 'No matches'}</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={stickyTh}>Staff</th>
                    <th style={stickyTh}>Project</th>
                    <th style={stickyTh}>Hours</th>
                    <th style={stickyTh}>Week</th>
                    <th style={stickyTh}>Submitted</th>
                    <th style={stickyTh}>Status</th>
                    <th style={stickyTh}>Actioned By</th>
                    <th style={stickyTh}>Actioned</th>
                    <th style={stickyTh}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.slice(0, 200).map(e => (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setHistoryEntry(e)} title="Click to view details">
                      <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                      <td>{e.project}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>
                        {e.hours}h
                        {e.corrected && <span title="Hours were corrected" style={{ marginLeft: 4, color: 'var(--warning)' }}>✏️</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{e.submittedAt ? fmtDateTime(e.submittedAt) : '—'}</td>
                      <td>
                        <span className={`badge badge-${e.status === 'approved' ? 'green' : 'red'}`}>{e.status}</span>
                      </td>
                      <td>{actionedByName(e)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDateTime(e.approvedAt || e.rejectedAt || '')}</td>
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
        )
      })()}

      {tab === 'export' && isAdmin && (() => {
        const allWeeks = Array.from(new Set(entries.filter(e => !e.deleted).map(e => e.weekKey))).sort().reverse()
        const allStatuses = [
          { value: 'draft', label: 'Draft' },
          { value: 'submitted', label: 'Submitted' },
          { value: 'resubmitted', label: 'Resubmitted' },
          { value: 'pending_clarification', label: 'Pending Clarification' },
          { value: 'pending_2nd_approval', label: 'Pending 2nd Review' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ]

        function toggleFilter(key: 'statuses' | 'departments' | 'weeks', value: string) {
          setExportFilters(f => {
            const cur = f[key]
            return { ...f, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
          })
        }
        function toggleAll(key: 'statuses' | 'departments' | 'weeks', allValues: string[]) {
          setExportFilters(f => ({ ...f, [key]: f[key].length === allValues.length ? [] : allValues }))
        }

        const hasFilters = exportFilters.statuses.length > 0 || exportFilters.departments.length > 0 || exportFilters.weeks.length > 0

        const exportRows = entries.filter(e => {
          if (e.deleted) return false
          if (exportFilters.statuses.length > 0 && !exportFilters.statuses.includes(e.status)) return false
          if (exportFilters.departments.length > 0) {
            const s = staff.find(m => m.id === e.staffId)
            if (!s?.department || !exportFilters.departments.includes(s.department)) return false
          }
          if (exportFilters.weeks.length > 0 && !exportFilters.weeks.includes(e.weekKey)) return false
          return true
        })

        const toExportRows = exportRows.map(e => ({
          'Staff': e.staffName,
          'Department': staff.find(s => s.id === e.staffId)?.department || '',
          'Project': e.project,
          'Lead': e.lead || '',
          'Week': weekRange(e.weekKey),
          'Date': fmtDate(e.date),
          'Hours': e.hours,
          'Category': e.category || '',
          'Description': e.description,
          'Status': e.status,
          'Submitted At': fmtDate(e.submittedAt || ''),
          'Approved By': e.approvedByName || '',
          'Approved At': fmtDate(e.approvedAt || ''),
          'Rejection Reason': e.rejectionReason || '',
          'Correction Note': e.correctionNote || '',
        }))

        const pdfColumns = [
          { key: 'Staff', label: 'Staff' }, { key: 'Department', label: 'Dept' },
          { key: 'Project', label: 'Project' }, { key: 'Lead', label: 'Lead' },
          { key: 'Week', label: 'Week' }, { key: 'Hours', label: 'Hrs' },
          { key: 'Status', label: 'Status' }, { key: 'Approved By', label: 'Actioned By' },
          { key: 'Rejection Reason', label: 'Note' },
        ]

        async function doExport(format: 'csv' | 'pdf') {
          if (!toExportRows.length) { toast.error('No entries match the selected filters'); return }
          setExporting(true)
          try {
            const label = `approvals_export_${new Date().toISOString().slice(0, 10)}`
            if (format === 'csv') {
              exportCSV(toExportRows, `${label}.csv`)
              toast.success(`Exported ${toExportRows.length} entries as CSV`)
            } else {
              const title = `Timesheet Export — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              await exportPDF(toExportRows, pdfColumns, title, `${label}.pdf`)
              toast.success(`Exported ${toExportRows.length} entries as PDF`)
            }
          } catch { toast.error('Export failed') }
          finally { setExporting(false) }
        }

        const statusCountMap = Object.fromEntries(allStatuses.map(s => [s.value, entries.filter(e => !e.deleted && e.status === s.value).length]))

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ paddingBottom: 12 }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Export Timesheet Data</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Filter entries across all staff — empty selection means all included. Export as CSV or PDF.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <MultiSelectDropdown label="Status" filterKey="statuses" items={allStatuses} selected={exportFilters.statuses} onToggle={v => toggleFilter('statuses', v)} onToggleAll={() => toggleAll('statuses', allStatuses.map(s => s.value))} countMap={statusCountMap} />
                <MultiSelectDropdown label="Department" filterKey="departments" items={departments.map(d => ({ value: d, label: d }))} selected={exportFilters.departments} onToggle={v => toggleFilter('departments', v)} onToggleAll={() => toggleAll('departments', departments)} />
                <MultiSelectDropdown label="Weeks" filterKey="weeks" items={allWeeks.map(w => ({ value: w, label: weekRange(w) }))} selected={exportFilters.weeks} onToggle={v => toggleFilter('weeks', v)} onToggleAll={() => toggleAll('weeks', allWeeks)} />
              </div>
            </div>

            {/* Preview count + actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{exportRows.length}</span>
                <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 8 }}>entries match</span>
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {exportFilters.statuses.map(s => <span key={s} className="badge badge-blue" style={{ fontSize: 10 }}>{s.replace(/_/g, ' ')}</span>)}
                  {exportFilters.departments.map(d => <span key={d} className="badge badge-gray" style={{ fontSize: 10 }}>{d}</span>)}
                  {exportFilters.weeks.length > 0 && exportFilters.weeks.length <= 3
                    ? exportFilters.weeks.map(w => <span key={w} className="badge badge-gray" style={{ fontSize: 10 }}>{weekRange(w)}</span>)
                    : exportFilters.weeks.length > 3 && <span className="badge badge-gray" style={{ fontSize: 10 }}>{exportFilters.weeks.length} weeks</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {hasFilters && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setExportFilters({ statuses: [], departments: [], weeks: [] })}>
                    Clear all
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" disabled={exporting || !exportRows.length} onClick={() => doExport('csv')}>
                  ⬇ CSV
                </button>
                <button className="btn btn-primary btn-sm" disabled={exporting || !exportRows.length} onClick={() => doExport('pdf')}>
                  {exporting ? 'Generating…' : '⬇ PDF'}
                </button>
              </div>
            </div>

            {/* Preview table */}
            {exportRows.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', fontSize: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Staff</th><th>Dept</th><th>Project</th><th>Lead</th>
                        <th>Week</th><th>Hrs</th><th>Status</th><th>Submitted</th><th>Actioned By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportRows.slice(0, 50).map(e => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600 }}>{e.staffName}</td>
                          <td style={{ color: 'var(--text-3)' }}>{staff.find(s => s.id === e.staffId)?.department || '—'}</td>
                          <td>{e.project}</td>
                          <td style={{ color: 'var(--text-3)' }}>{e.lead || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-3)' }}>{weekRange(e.weekKey)}</td>
                          <td style={{ fontFamily: 'var(--mono)' }}>{e.hours}h</td>
                          <td>
                            <span className={`badge badge-${
                              e.status === 'approved' ? 'green' :
                              e.status === 'rejected' ? 'red' :
                              e.status === 'submitted' || e.status === 'resubmitted' ? 'blue' : 'gray'
                            }`} style={{ fontSize: 10 }}>{e.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(e.submittedAt || '')}</td>
                          <td style={{ color: 'var(--text-3)' }}>{e.approvedByName || e.rejectedBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {exportRows.length > 50 && (
                    <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: 'var(--text-3)' }}>
                      Showing 50 of {exportRows.length} — all rows included in export
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {selectedEntry && (
        <ApprovalModal
          entry={selectedEntry}
          staff={staff}
          onClose={() => setSelectedEntry(null)}
          onAction={handleAction}
        />
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.action}
        onCancel={() => setConfirmAction({isOpen: false, action: () => {}, message: ''})}
      />

      {/* History detail modal — read-only view of a past entry */}
      {historyEntry && (
        <div className="modal-overlay" onClick={() => setHistoryEntry(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Entry Detail</span>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setHistoryEntry(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="grid-2">
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Staff</span><strong>{historyEntry.staffName}</strong></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Department</span>{staff.find(s => s.id === historyEntry.staffId)?.department || '—'}</div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Project</span><strong>{historyEntry.project}</strong></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Lead</span>{historyEntry.lead || '—'}</div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Date</span>{fmtDate(historyEntry.date)}</div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Hours</span><strong>{historyEntry.hours}h{historyEntry.corrected ? ' ✏️ (corrected)' : ''}</strong></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Category</span>{historyEntry.category}</div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Week</span>{weekRange(historyEntry.weekKey)}</div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Status</span>
                    <span className={`badge badge-${historyEntry.status === 'approved' ? 'green' : 'red'}`}>{historyEntry.status}</span>
                  </div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Submitted</span>{fmtDate(historyEntry.submittedAt || '')}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Description</span>
                  <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{historyEntry.description}</p>
                </div>
                {(historyEntry.rejectionReason || historyEntry.correctionNote) && (
                  <div style={{ background: historyEntry.status === 'rejected' ? 'var(--danger-bg)' : 'var(--warning-bg)', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: historyEntry.status === 'rejected' ? 'var(--danger)' : 'var(--warning)' }}>
                    <strong>{historyEntry.status === 'rejected' ? 'Rejection reason' : 'Correction note'}:</strong> {historyEntry.rejectionReason || historyEntry.correctionNote}
                  </div>
                )}
              </div>
              {historyEntry.approvalHistory && historyEntry.approvalHistory.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Approval History</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...historyEntry.approvalHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(h => (
                      <div key={h.id} style={{ fontSize: 12, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <strong>{h.reviewerName}</strong>
                          <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>({h.reviewerRole})</span>
                          <span style={{ marginLeft: 8 }}>{h.action}{h.correctedHours ? ` → ${h.correctedHours}h` : ''}</span>
                          {h.note && <div style={{ color: 'var(--text-2)', marginTop: 2 }}>{h.note}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtDate(h.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setHistoryEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
