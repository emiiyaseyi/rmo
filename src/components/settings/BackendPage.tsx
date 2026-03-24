'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { exportCSV } from '../../lib/utils'
import toast from 'react-hot-toast'

const TABLES = ['staff', 'entries', 'messages', 'leaves', 'rewards', 'redeems', 'delegations', 'budgets', 'templates']

function LocalTableBrowser({ tableName }: { tableName: string }) {
  const allData: any = {
    staff:       [],
    entries:     [],
    messages:    [],
    leaves:      [],
    rewards:     [],
    redeems:     [],
    budgets:     [],
    templates:   [],
  }
  const rows = allData[tableName] || []
  const cols = rows.length > 0 ? Object.keys(rows[0]) : []

  function exportTable() {
    if (rows.length === 0) { toast.error('No data to export'); return }
    exportCSV(rows, `${tableName}_export.csv`)
    toast.success(`${tableName} exported`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{rows.length} records</span>
        <button className="btn btn-secondary btn-sm" onClick={exportTable}>⬇ Export CSV</button>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-title">No data in {tableName}</div></div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
              <tr>
                {cols.map(c => (
                  <th key={c} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {cols.map(c => {
                    const val = row[c]
                    const display = val === null || val === undefined ? '' :
                      typeof val === 'boolean' ? (val ? '✓' : '✗') :
                      typeof val === 'object' ? JSON.stringify(val).slice(0, 60) :
                      String(val).slice(0, 80)
                    return (
                      <td key={c} style={{ padding: '6px 12px', color: 'var(--text-2)', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(val || '')}>
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
              Showing first 200 of {rows.length} records. Export CSV for full data.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SystemStats() {
  const keys = typeof localStorage !== 'undefined' ? Object.keys(localStorage).filter(k => k.startsWith('dsn_')) : []
  const totalSize = keys.reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0)
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2)

  const tables = keys.map(k => {
    const name = k.replace('dsn_', '')
    const val = localStorage.getItem(k) || ''
    try {
      const parsed = JSON.parse(val)
      const count = Array.isArray(parsed) ? parsed.length : null
      return { name, size: (val.length / 1024).toFixed(1) + ' KB', count }
    } catch {
      return { name, size: (val.length / 1024).toFixed(1) + ' KB', count: null }
    }
  })

  function clearTable(name: string) {
    if (!window.confirm(`Clear all data in "${name}"? This cannot be undone.`)) return
    localStorage.removeItem('dsn_' + name)
    toast.success(`${name} cleared`)
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-label">Total Storage Used</div>
          <div className="stat-value">{sizeMB} MB</div>
          <div className="stat-sub">of ~5MB localStorage limit</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <div className="progress-bar" style={{ width: `${Math.min((parseFloat(sizeMB)/5)*100, 100)}%`, background: parseFloat(sizeMB) > 4 ? 'var(--danger)' : 'var(--accent)' }} />
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-label">Data Tables</div>
          <div className="stat-value">{tables.length}</div>
          <div className="stat-sub">localStorage keys</div>
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Table</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Records</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Size</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tables.map(t => (
              <tr key={t.name} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-2)' }}>{t.count ?? '—'}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>{t.size}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                  {['staff','entries','messages','leaves'].includes(t.name) && (
                    <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => clearTable(t.name)}>Clear</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BackendPage() {
  const { user } = useApp()
  const [tab, setTab] = useState('tables')
  const [activeTable, setActiveTable] = useState('staff')

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state card">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Admin access required</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🔧 Backend Admin Panel</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          Direct local data access and system stats
        </p>
      </div>

      <div className="tabs">
        {[
          ['tables',   '📊 Table Browser'],
          ['system',   '💾 System Stats'],
        ].map(([id, label]) => (
          <div key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {/* TABLE BROWSER */}
      {tab === 'tables' && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Table list */}
          <div style={{ width: 160, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Tables</div>
            {TABLES.map(t => {
              const count = (() => {
                try {
                  const d = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem('dsn_' + t) || '[]' : '[]')
                  return Array.isArray(d) ? d.length : '?'
                } catch { return '?' }
              })()
              return (
                <div
                  key={t}
                  onClick={() => setActiveTable(t)}
                  style={{
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                    background: activeTable === t ? 'var(--accent-subtle)' : 'transparent',
                    color: activeTable === t ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 13, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                  onMouseEnter={e => { if (activeTable !== t) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (activeTable !== t) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{t}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{count}</span>
                </div>
              )
            })}
          </div>
          {/* Table content */}
          <div className="card" style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              {activeTable}
            </div>
            <LocalTableBrowser tableName={activeTable} />
          </div>
        </div>
      )}

      {/* SYSTEM STATS */}
      {tab === 'system' && (
        <SystemStats />
      )}
    </div>
  )
}
