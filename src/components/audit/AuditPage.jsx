import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { local, exportCSV } from '../../lib/utils'
import toast from 'react-hot-toast'

const ACTION_ICONS = {
  LOGIN: '🔐', LOGOUT: '🚪', LOCKOUT: '🔒',
  ADD_ENTRY: '➕', EDIT_ENTRY: '✏️', DELETE_ENTRY: '🗑️', SUBMIT_WEEK: '📤',
  APPROVAL_APPROVE: '✅', APPROVAL_REJECT: '❌', APPROVAL_CLARIFY: '❓', APPROVAL_APPROVE_CORRECTION: '✏️✅',
  ADD_STAFF: '👤', EDIT_STAFF: '✏️', SUSPEND_STAFF: '🚫', UNSUSPEND_STAFF: '✅', RESET_PIN: '🔑', FORCE_LOGOUT: '🚪',
  BULK_IMPORT_STAFF: '📥', BULK_IMPORT_ENTRIES: '📥',
}

export default function AuditPage() {
  const { staff } = useApp()
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const logs = local.get('audit_logs', [])

  const filtered = useMemo(() => logs.filter(l => {
    if (filterUser && l.userId !== filterUser) return false
    if (filterAction && !l.action.includes(filterAction.toUpperCase())) return false
    if (filterFrom && new Date(l.timestamp) < new Date(filterFrom)) return false
    if (filterTo && new Date(l.timestamp) > new Date(filterTo + 'T23:59:59')) return false
    return true
  }), [logs, filterUser, filterAction, filterFrom, filterTo])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > page * PAGE_SIZE

  function exportAudit() {
    exportCSV(filtered.map(l => ({
      Timestamp: new Date(l.timestamp).toLocaleString(),
      User: l.userName,
      Action: l.action,
      Detail: l.detail,
    })), 'dsn_audit_trail.csv')
    toast.success('Audit trail exported')
  }

  const actionTypes = [...new Set(logs.map(l => l.action.split('_')[0]))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>📝 Audit Trail</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{logs.length.toLocaleString()} events logged</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportAudit}>⬇ Export CSV</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: 'auto' }} value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1) }}>
          <option value="">All Users</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="form-input" style={{ width: 160 }} placeholder="Filter action..." value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }} />
        <input className="form-input" type="date" style={{ width: 160 }} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} />
        <span style={{ alignSelf: 'center', color: 'var(--text-3)', fontSize: 13 }}>to</span>
        <input className="form-input" type="date" style={{ width: 160 }} value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} />
        {(filterUser || filterAction || filterFrom || filterTo) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilterUser(''); setFilterAction(''); setFilterFrom(''); setFilterTo(''); setPage(1) }}>
            Clear Filters
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Showing {Math.min(paginated.length, filtered.length)} of {filtered.length} events
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {paginated.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">No events found</div>
            <div className="empty-state-desc">Try adjusting your filters</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((l, i) => (
                  <tr key={l.id || i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text-3)' }}>
                      {new Date(l.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{l.userName || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{ACTION_ICONS[l.action] || '📌'}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{l.action}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.detail}>
                        {l.detail}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && (
        <button className="btn btn-secondary w-full" onClick={() => setPage(p => p + 1)}>
          Load more ({filtered.length - paginated.length} remaining)
        </button>
      )}
    </div>
  )
}
