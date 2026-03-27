'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function LeaveApprovalsPage() {
  const { user, leaves, saveLeaves, staff, notify } = useApp()
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [selectedLeave, setSelectedLeave] = useState<any>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const isAdmin = user?.role === 'admin'
  const isTeamLead = user?.role === 'team_lead'

  // Get leaves that need approval from current user
  const pendingLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (l.status === 'rejected' || l.status === 'approved') return false

      // Team leads see pending leaves from their team members
      if (isTeamLead && l.status === 'pending') {
        const staffMember = staff.find(s => s.id === l.staffId)
        return staffMember?.leadId === user?.id
      }

      // Admins see lead_approved leaves and pending leaves without a team lead
      if (isAdmin) {
        if (l.status === 'lead_approved') return true
        if (l.status === 'pending') {
          const staffMember = staff.find(s => s.id === l.staffId)
          return !staffMember?.leadId // No team lead assigned
        }
      }

      return false
    })
  }, [leaves, staff, user, isAdmin, isTeamLead])

  const historyLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (l.status !== 'approved' && l.status !== 'rejected') return false

      // Show leaves approved/rejected by current user
      if (isTeamLead) {
        return l.leadApprovedBy === user?.id || l.rejectedBy === user?.id
      }

      if (isAdmin) {
        return l.approvedBy === user?.id || l.rejectedBy === user?.id || l.leadApprovedBy === user?.id
      }

      return false
    })
  }, [leaves, user, isAdmin, isTeamLead])

  function handleApprove(leaveId: string) {
    const leave = leaves.find(l => l.id === leaveId)
    if (!leave) return

    const now = new Date().toISOString()
    let updates: any = {}

    if (isTeamLead && leave.status === 'pending') {
      // Team lead approval - move to lead_approved
      updates = {
        status: 'lead_approved',
        leadApprovedBy: user?.id,
        leadApprovedAt: now
      }

      // Notify admins for final approval
      const admins = staff.filter(s => s.role === 'admin')
      admins.forEach(admin => {
        notify(admin.id, `${leave.staffName}'s ${leave.type} leave (${leave.from} to ${leave.to}) approved by team lead, requires admin approval`, 'leave_request', 'Leave Pending Admin Approval', leave.id, 'leave')
      })

      // Notify staff member
      notify(leave.staffId, `Your ${leave.type} leave request has been approved by your team lead and is pending admin approval`, 'info', 'Leave Approved by Team Lead', leave.id, 'leave')

      toast.success('Leave approved - sent to admin for final approval')
    } else if (isAdmin) {
      // Admin approval - final approval
      updates = {
        status: 'approved',
        approvedBy: user?.id,
        approvedAt: now
      }

      // Notify staff member
      notify(leave.staffId, `Your ${leave.type} leave request has been fully approved`, 'success', 'Leave Approved', leave.id, 'leave')

      toast.success('Leave fully approved')
    }

    const updated = leaves.map(l => l.id === leaveId ? { ...l, ...updates } : l)
    saveLeaves(updated)
    setSelectedLeave(null)
  }

  function handleReject(leaveId: string) {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    const leave = leaves.find(l => l.id === leaveId)
    if (!leave) return

    const now = new Date().toISOString()
    const updates = {
      status: 'rejected' as const,
      rejectedBy: user?.id,
      rejectedAt: now,
      rejectionReason: rejectionReason.trim()
    }

    const updated = leaves.map(l => l.id === leaveId ? { ...l, ...updates } : l)
    saveLeaves(updated)

    // Notify staff member
    notify(leave.staffId, `Your ${leave.type} leave request has been rejected: ${rejectionReason}`, 'danger', 'Leave Rejected', leave.id, 'leave')

    toast.success('Leave rejected')
    setSelectedLeave(null)
    setRejectionReason('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>📋 Leave Approvals</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          Review and approve leave requests
        </p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending ({pendingLeaves.length})
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {tab === 'pending' && (
        <>
          {pendingLeaves.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No pending leave requests</div>
              <div className="empty-state-desc">All leave requests have been reviewed</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Days</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeaves.map(leave => {
                      const days = Math.ceil((new Date(leave.to).getTime() - new Date(leave.from).getTime()) / (1000 * 60 * 60 * 24)) + 1
                      return (
                        <tr key={leave.id}>
                          <td style={{ fontWeight: 600 }}>{leave.staffName}</td>
                          <td><span className="badge badge-blue">{leave.type}</span></td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(leave.from)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(leave.to)}</td>
                          <td style={{ fontWeight: 700 }}>{days} day{days !== 1 ? 's' : ''}</td>
                          <td>
                            <span className={`badge badge-${leave.status === 'lead_approved' ? 'blue' : 'yellow'}`}>
                              {leave.status === 'lead_approved' ? 'Lead Approved' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 200 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {leave.reason || '—'}
                            </div>
                          </td>
                          <td>
                            <button className="btn btn-primary btn-sm" onClick={() => setSelectedLeave(leave)}>
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
          {historyLeaves.length === 0 ? (
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
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Approved/Rejected By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLeaves.sort((a, b) => new Date(b.approvedAt || b.rejectedAt || b.createdAt || '').getTime() - new Date(a.approvedAt || a.rejectedAt || a.createdAt || '').getTime()).slice(0, 100).map(leave => (
                    <tr key={leave.id}>
                      <td style={{ fontWeight: 600 }}>{leave.staffName}</td>
                      <td><span className="badge badge-blue">{leave.type}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(leave.from)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(leave.to)}</td>
                      <td>
                        <span className={`badge badge-${leave.status === 'approved' ? 'green' : 'red'}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {leave.status === 'approved'
                          ? staff.find(s => s.id === leave.approvedBy)?.name || '—'
                          : staff.find(s => s.id === leave.rejectedBy)?.name || '—'
                        }
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {fmtDate(leave.approvedAt || leave.rejectedAt || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedLeave && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedLeave(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Review Leave Request</span>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setSelectedLeave(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="grid-2">
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Staff</span>
                    <strong>{selectedLeave.staffName}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Type</span>
                    <span className="badge badge-blue">{selectedLeave.type}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>From</span>
                    <strong>{fmtDate(selectedLeave.from)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>To</span>
                    <strong>{fmtDate(selectedLeave.to)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Duration</span>
                    <strong>
                      {Math.ceil((new Date(selectedLeave.to).getTime() - new Date(selectedLeave.from).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block' }}>Status</span>
                    <span className={`badge badge-${selectedLeave.status === 'lead_approved' ? 'blue' : 'yellow'}`}>
                      {selectedLeave.status === 'lead_approved' ? 'Lead Approved' : 'Pending'}
                    </span>
                  </div>
                </div>
                {selectedLeave.reason && (
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Reason</span>
                    <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{selectedLeave.reason}</p>
                  </div>
                )}
                {selectedLeave.leadApprovedBy && (
                  <div style={{ background: 'var(--success-bg)', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--success)' }}>
                    <strong>Team Lead Approved:</strong> {staff.find(s => s.id === selectedLeave.leadApprovedBy)?.name} on {fmtDate(selectedLeave.leadApprovedAt)}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Rejection Reason (if rejecting)</label>
                <textarea
                  className="form-textarea"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLeave(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => handleReject(selectedLeave.id)}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </button>
              <button className="btn btn-success" onClick={() => handleApprove(selectedLeave.id)}>
                {isTeamLead ? 'Approve (Send to Admin)' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
