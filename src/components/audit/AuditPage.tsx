'use client'
import React, { useState } from 'react'
import { exportCSV } from '../../lib/utils'
import { useApp } from '../../context/AppContext'

interface AuditLog {
  id: string;
  action: string;
  detail: string;
  userId: string;
  userName: string;
  device?: string;
  timestamp: string;
  metadata?: any;
}

export default function AuditPage() {
  const { auditLogs, staff } = useApp()
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate] = useState('')

  // Filter out login/logout events - Audit Trail is for business events only
  const businessLogs = (auditLogs || []).filter(l =>
    l.action !== 'login' && l.action !== 'logout'
  )

  const filtered = businessLogs.filter(l => {
    if (search && !l.userName?.toLowerCase().includes(search.toLowerCase()) && !l.action?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterAction && !l.action?.includes(filterAction)) return false
    if (filterDate && !l.timestamp?.startsWith(filterDate)) return false
    return true
  })

  const actionTypes = Array.from(new Set(businessLogs.map(l => l.action?.split('_')[0]).filter(Boolean))) as string[]

  // Format detail with human-readable description
  function formatDetail(log: AuditLog): string {
    const meta = log.metadata || {}
    const userName = log.userName || 'User'

    switch (log.action) {
      // Leave events
      case 'leave_request':
        return `${meta.staffName || userName} requested ${meta.type || ''} leave (${meta.from} to ${meta.to})`
      case 'leave_lead_approval':
        return `${meta.approver} approved ${meta.staffName}'s ${meta.type} leave request (Team Lead)`
      case 'leave_admin_approval':
        return `${meta.approver} approved ${meta.staffName}'s ${meta.type} leave request (Admin)`
      case 'leave_rejection':
        return `${meta.rejector} rejected ${meta.staffName}'s ${meta.type} leave request${meta.reason ? ': ' + meta.reason : ''}`

      // Timesheet events
      case 'submit':
        return `${userName} submitted timesheet for week ${meta.weekKey} (${meta.totalHours}h)`
      case 'APPROVAL_APPROVED':
        return `${userName} approved timesheet entry by ${log.detail?.split('approved entry by ')[1]?.split(' for')[0] || 'staff'}`
      case 'APPROVAL_REJECTED':
        return `${userName} rejected timesheet entry by ${log.detail?.split('rejected entry by ')[1]?.split(' for')[0] || 'staff'}`
      case 'ADD_ENTRY':
        return `${userName} added timesheet entry`
      case 'EDIT_ENTRY':
        return `${userName} edited timesheet entry`
      case 'DELETE_ENTRY':
        return `${userName} deleted timesheet entry`
      case 'ADMIN_OVERRIDE':
        return `${userName} overrode timesheet entry`

      // Staff management events
      case 'ADD_STAFF':
        return `${userName} added staff member: ${meta.name || log.detail?.split('added ')[1] || 'N/A'}`
      case 'EDIT_STAFF':
        return `${userName} edited staff member: ${meta.name || log.detail?.split('edited ')[1] || 'N/A'}`
      case 'DELETE_STAFF':
        return `${userName} deleted ${meta.count || log.detail?.match(/\d+/)?.[0] || '1'} staff member(s)`
      case 'BULK_SUSPEND':
        return `${userName} suspended ${meta.count || log.detail?.match(/\d+/)?.[0] || 'multiple'} staff member(s)`
      case 'BULK_UNSUSPEND':
        return `${userName} unsuspended ${meta.count || log.detail?.match(/\d+/)?.[0] || 'multiple'} staff member(s)`
      case 'BULK_EDIT_STAFF':
        return `${userName} bulk edited ${meta.count || log.detail?.match(/\d+/)?.[0] || 'multiple'} staff member(s)`
      case 'ACCOUNT_UNLOCK':
        return `${userName} unlocked account for ${log.detail?.split('unlocked account for ')[1] || 'staff'}`
      case 'FORCE_LOGOUT':
        return `${userName} force logged out ${log.detail?.split('force logged out ')[1] || 'user'}`

      // Project events
      case 'project_create':
        return `${userName} created project: ${meta.name || 'N/A'}`
      case 'project_update':
        return `${userName} updated project: ${meta.name || 'N/A'}`
      case 'project_delete':
        return `${userName} deleted project: ${meta.name || 'N/A'}`
      case 'project_bulk_import':
        return `${userName} bulk imported ${meta.count || 0} projects`

      // Settings events
      case 'settings_change':
        return `${userName} updated system settings`
      case 'BULK_IMPORT_ENTRIES':
        return log.detail || `${userName} bulk imported timesheet entries`

      // Default fallback
      default:
        return log.detail || `${userName} performed ${log.action}`
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>📝 Audit Trail</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{businessLogs.length} business events logged (login/logout excluded)</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered.map(l => ({ Time: l.timestamp, User: l.userName, Action: l.action, Detail: formatDetail(l) })), 'audit_trail.csv')}>
          ⬇ Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search by user or action…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="form-select" style={{ width: 'auto' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className="form-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">No audit logs yet</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 500).map((l, i) => (
                  <tr key={l.id || i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text-3)' }}>
                      {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${
                        l.action?.includes('approval') || l.action?.includes('APPROVE') ? 'green' :
                        l.action?.includes('rejection') || l.action?.includes('REJECT') ? 'red' :
                        l.action?.includes('delete') || l.action?.includes('DELETE') ? 'red' :
                        l.action?.includes('request') || l.action?.includes('submit') ? 'blue' :
                        l.action?.includes('create') || l.action?.includes('ADD') ? 'green' :
                        l.action?.includes('edit') || l.action?.includes('EDIT') || l.action?.includes('update') ? 'yellow' :
                        'gray'
                      }`}>{l.action}</span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {formatDetail(l)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {filtered.length > 500 && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Showing 500 of {filtered.length} — export CSV for full log</div>
      )}
    </div>
  )
}
