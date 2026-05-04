'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { exportCSV } from '../../lib/utils'

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

const PAGE_SIZE = 50

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const fetchLogs = useCallback(async (off: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-logs?limit=${PAGE_SIZE}&offset=${off}`)
      if (!res.ok) return
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setOffset(off)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLogs(0) }, [fetchLogs])

  const businessLogs = logs.filter(l => l.action !== 'login' && l.action !== 'logout')

  const filtered = businessLogs.filter(l => {
    if (search && !l.userName?.toLowerCase().includes(search.toLowerCase()) && !l.action?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterAction && !l.action?.includes(filterAction)) return false
    if (filterDate && !l.timestamp?.startsWith(filterDate)) return false
    return true
  })

  const actionTypes = Array.from(new Set(businessLogs.map(l => l.action?.split('_')[0]).filter(Boolean))) as string[]
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  function formatDetail(log: AuditLog): string {
    const meta = log.metadata || {}
    const userName = log.userName || 'User'

    switch (log.action) {
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
      case 'project_create':
        return `${userName} created project: ${meta.name || 'N/A'}`
      case 'project_update':
        return `${userName} updated project: ${meta.name || 'N/A'}`
      case 'project_delete':
        return `${userName} deleted project: ${meta.name || 'N/A'}`
      case 'project_bulk_import':
        return `${userName} bulk imported ${meta.count || 0} projects`
      case 'settings_change':
        return `${userName} updated system settings`
      case 'BULK_IMPORT_ENTRIES':
        return log.detail || `${userName} bulk imported timesheet entries`
      default:
        return log.detail || `${userName} performed ${log.action}`
    }
  }

  async function handleExport() {
    // Fetch all for export
    const res = await fetch(`/api/audit-logs?limit=200&offset=0`)
    const data = await res.json()
    const allLogs: AuditLog[] = data.logs ?? []
    exportCSV(allLogs.map(l => ({ Time: l.timestamp, User: l.userName, Action: l.action, Detail: formatDetail(l) })), 'audit_trail.csv')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>📝 Audit Trail</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{total} business events logged (login/logout excluded)</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExport}>⬇ Export CSV</button>
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
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
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
                {filtered.map((l, i) => (
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
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{formatDetail(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => fetchLogs(Math.max(0, offset - PAGE_SIZE))}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Page {currentPage} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={offset + PAGE_SIZE >= total} onClick={() => fetchLogs(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </div>
  )
}
