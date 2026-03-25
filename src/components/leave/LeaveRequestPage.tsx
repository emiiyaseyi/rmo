'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, fmtDate } from '../../lib/utils'
import { Leave } from '../../types'
import toast from 'react-hot-toast'

export default function LeaveRequestPage() {
  const { user, leaves, saveLeaves, staff, notify } = useApp()
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', from: '', to: '', reason: '' })

  const myLeaves = leaves.filter(l => l.staffId === user?.id).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  function submitLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!leaveForm.from || !leaveForm.to) {
      toast.error('Select dates')
      return
    }
    if (new Date(leaveForm.from) > new Date(leaveForm.to)) {
      toast.error('End date must be after start')
      return
    }

    // Get user's team lead
    const userStaff = staff.find(s => s.id === user?.id)
    const leadId = userStaff?.leadId

    const req: Leave = {
      id: genId(),
      staffId: user?.id || '',
      staffName: user?.name || '',
      type: leaveForm.type,
      from: leaveForm.from,
      to: leaveForm.to,
      reason: leaveForm.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      leadId
    }

    saveLeaves([...leaves, req])

    // Notify team lead first
    if (leadId) {
      notify(leadId, `${user?.name} requested ${leaveForm.type} leave (${leaveForm.from} to ${leaveForm.to})`, 'leave_request', 'Leave Request', req.id, 'leave')
    } else {
      // If no team lead, notify admins directly
      staff.filter(s => s.role === 'admin').forEach(a =>
        notify(a.id, `${user?.name} requested ${leaveForm.type} leave (${leaveForm.from} to ${leaveForm.to})`, 'leave_request', 'Leave Request', req.id, 'leave')
      )
    }

    setLeaveForm({ type: 'Annual', from: '', to: '', reason: '' })
    toast.success('Leave request submitted')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏝️ Request Leave</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          Submit leave requests for approval
        </p>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ fontWeight: 700, marginBottom: 16 }}>Request Leave</div>
        <form onSubmit={submitLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Leave Type</label>
            <select
              className="form-select"
              value={leaveForm.type}
              onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}
            >
              {['Annual', 'Sick', 'Maternity', 'Paternity', 'Study', 'Emergency', 'Unpaid'].map(t => (
                <option key={t} value={t}>{t} Leave</option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">From</label>
              <input
                className="form-input"
                type="date"
                value={leaveForm.from}
                onChange={e => setLeaveForm(f => ({ ...f, from: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input
                className="form-input"
                type="date"
                value={leaveForm.to}
                onChange={e => setLeaveForm(f => ({ ...f, to: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="form-textarea"
              value={leaveForm.reason}
              onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
              rows={2}
            />
          </div>
          <button className="btn btn-primary" type="submit">Submit Request</button>
        </form>
      </div>

      {myLeaves.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            Leave History
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Approved By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.map(l => (
                  <tr key={l.id}>
                    <td><span className="badge badge-blue">{l.type}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(l.from)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(l.to)}</td>
                    <td>
                      <span className={`badge badge-${
                        l.status === 'approved' ? 'green' :
                        l.status === 'lead_approved' ? 'blue' :
                        l.status === 'rejected' ? 'red' :
                        'yellow'
                      }`}>
                        {l.status === 'lead_approved' ? 'Lead Approved' : l.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {l.status === 'lead_approved' && l.leadApprovedBy ? (
                        <span style={{ color: 'var(--text-3)' }}>
                          Lead: {staff.find(s => s.id === l.leadApprovedBy)?.name || 'Unknown'}
                        </span>
                      ) : l.status === 'approved' && l.approvedBy ? (
                        <span style={{ color: 'var(--text-3)' }}>
                          {l.leadApprovedBy && 'Lead → '}Admin: {staff.find(s => s.id === l.approvedBy)?.name || 'Unknown'}
                        </span>
                      ) : l.status === 'rejected' && l.rejectedBy ? (
                        <span style={{ color: 'var(--danger)' }}>
                          {staff.find(s => s.id === l.rejectedBy)?.name || 'Unknown'}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.rejectionReason || l.reason || '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
