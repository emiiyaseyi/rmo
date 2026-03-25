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
}

export default function AuditPage() {
  const { auditLogs } = useApp()
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const logs = auditLogs || []

  const filtered = logs.filter(l => {
    if (search && !l.userName?.toLowerCase().includes(search.toLowerCase()) && !l.action?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterAction && !l.action?.includes(filterAction)) return false
    if (filterDate && !l.timestamp?.startsWith(filterDate)) return false
    return true
  })

  const actionTypes = Array.from(new Set(logs.map(l => l.action?.split('_')[0]).filter(Boolean)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>📝 Audit Trail</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{logs.length} total events logged</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered.map(l => ({ Action: l.action, Detail: l.detail, User: l.userName, Time: l.timestamp, Device: l.device || '' })), 'audit_trail.csv')}>
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
                  <th>User</th>
                  <th>Action</th>
                  <th>Device</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((l, i) => (
                  <tr key={l.id || i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text-3)' }}>
                      {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.userName || '—'}</td>
                    <td>
                      <span className={`badge badge-${l.action?.includes('LOGIN') ? 'blue' :
                          l.action?.includes('APPROVE') ? 'green' :
                            l.action?.includes('REJECT') ? 'red' :
                              l.action?.includes('DELETE') ? 'red' :
                                l.action?.includes('LOCKOUT') ? 'red' :
                                  'gray'
                        }`}>{l.action}</span>
                    </td>
                    <td style={{ fontSize: 10, color: 'var(--text-4)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.device}>
                      {l.device || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 400 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.detail}</div>
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
