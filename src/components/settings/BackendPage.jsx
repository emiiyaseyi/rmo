import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { getSupabase } from '../../lib/supabase'
import { exportCSV, local } from '../../lib/utils'
import toast from 'react-hot-toast'

const TABLES = ['staff', 'entries', 'messages', 'leaves', 'rewards', 'redeems', 'delegations', 'budgets', 'templates']

const SQL_TEMPLATES = [
  { label: 'All approved entries this month', sql: `SELECT staff_name, project, SUM(hours) as total_hours\nFROM entries\nWHERE status = 'approved'\n  AND date >= date_trunc('month', CURRENT_DATE)\nGROUP BY staff_name, project\nORDER BY total_hours DESC;` },
  { label: 'Staff submission rates', sql: `SELECT staff_name, \n  COUNT(*) as total_entries,\n  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved\nFROM entries\nGROUP BY staff_name\nORDER BY staff_name;` },
  { label: 'Top projects by hours', sql: `SELECT project, SUM(hours) as total_hours, COUNT(*) as entry_count\nFROM entries\nWHERE status = 'approved'\nGROUP BY project\nORDER BY total_hours DESC\nLIMIT 10;` },
]

function LocalTableBrowser({ tableName }) {
  const allData = {
    staff:       JSON.parse(localStorage.getItem('dsn_staff')    || '[]'),
    entries:     JSON.parse(localStorage.getItem('dsn_entries')  || '[]'),
    messages:    JSON.parse(localStorage.getItem('dsn_messages') || '[]'),
    leaves:      JSON.parse(localStorage.getItem('dsn_leaves')   || '[]'),
    rewards:     JSON.parse(localStorage.getItem('dsn_rewards')  || '[]'),
    redeems:     JSON.parse(localStorage.getItem('dsn_redeems')  || '[]'),
    budgets:     JSON.parse(localStorage.getItem('dsn_budgets')  || '[]'),
    templates:   JSON.parse(localStorage.getItem('dsn_templates')|| '[]'),
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
              {rows.slice(0, 200).map((row, i) => (
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

function SupabaseQueryRunner() {
  const [sql, setSql]         = useState('')
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState('')
  const [history, setHistory] = useState(local.get('query_history', []))

  async function runQuery() {
    const sb = getSupabase()
    if (!sb) { toast.error('Supabase not connected — configure in Settings → Supabase'); return }
    if (!sql.trim()) return
    setRunning(true); setError(''); setResults(null)
    try {
      const { data, error: err } = await sb.rpc('run_query', { query: sql })
      if (err) throw err
      setResults(data || [])
      const h = [{ sql: sql.trim(), ts: new Date().toISOString(), rows: (data||[]).length }, ...history].slice(0, 20)
      setHistory(h); local.set('query_history', h)
      toast.success(`Query returned ${(data||[]).length} rows`)
    } catch (e) {
      setError(e.message || 'Query failed')
    }
    setRunning(false)
  }

  const resultCols = results && results.length > 0 ? Object.keys(results[0]) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warning)' }}>
        ⚠️ This requires a <code>run_query</code> Postgres function in your Supabase project. Only use with trusted SQL. Destructive queries (DROP, DELETE without WHERE) will affect live data.
      </div>

      {/* SQL Templates */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>Quick Templates</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SQL_TEMPLATES.map(t => (
            <button key={t.label} className="btn btn-secondary btn-sm" onClick={() => setSql(t.sql)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Query editor */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>SQL Query</div>
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="SELECT * FROM entries WHERE status = 'approved' LIMIT 50;"
          style={{
            width: '100%', minHeight: 120, fontFamily: 'var(--mono)', fontSize: 12,
            background: 'var(--bg-base)', color: 'var(--text-1)',
            border: '1px solid var(--border)', borderRadius: 8, padding: 12,
            resize: 'vertical', outline: 'none',
          }}
          onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') runQuery() }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Ctrl+Enter to run</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={runQuery} disabled={running || !sql.trim()}>
          {running ? '⏳ Running…' : '▶ Run Query'}
        </button>
        {results && <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(results, 'query_result.csv')}>⬇ Export CSV</button>}
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--mono)' }}>
          ✕ {error}
        </div>
      )}

      {results && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{results.length} rows returned</div>
          {results.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
                  <tr>
                    {resultCols.map(c => <th key={c} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {resultCols.map(c => <td key={c} style={{ padding: '6px 12px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{String(row[c] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Query returned no rows.</div>
          )}
        </div>
      )}

      {/* Query history */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>Recent Queries</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.slice(0, 5).map((h, i) => (
              <div key={i}
                onClick={() => setSql(h.sql)}
                style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                <code style={{ fontSize: 11, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sql.slice(0, 80)}</code>
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 12, flexShrink: 0 }}>{h.rows} rows</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SystemStats() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('dsn_'))
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

  function clearTable(name) {
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
      {parseFloat(sizeMB) > 4 && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          ⚠️ Storage nearly full. Connect Supabase to sync data and free up space, or export + clear old entries.
        </div>
      )}
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
  const [tab, setTab]         = useState('tables')
  const [activeTable, setActiveTable] = useState('staff')
  const isConnected = !!localStorage.getItem('dsn_sb_url')

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
          Direct data access, Supabase query runner, and system stats
        </p>
      </div>

      {/* Supabase status */}
      <div style={{
        background: isConnected ? 'var(--success-bg)' : 'var(--warning-bg)',
        border: `1px solid ${isConnected ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
        borderRadius: 8, padding: '10px 16px', fontSize: 13,
        color: isConnected ? 'var(--success)' : 'var(--warning)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        {isConnected ? '🟢 Supabase connected' : '🟡 Supabase not connected — showing localStorage data only'}
        {!isConnected && <span style={{ marginLeft: 'auto', fontSize: 12 }}>Configure in Settings → Supabase</span>}
      </div>

      <div className="tabs">
        {[
          ['tables',   '📊 Table Browser'],
          ['query',    '🔍 SQL Runner'],
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
                try { const d = JSON.parse(localStorage.getItem('dsn_' + t) || '[]'); return Array.isArray(d) ? d.length : '?' } catch { return '?' }
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

      {/* SQL RUNNER */}
      {tab === 'query' && (
        <div className="card">
          <SupabaseQueryRunner />
        </div>
      )}

      {/* SYSTEM STATS */}
      {tab === 'system' && (
        <SystemStats />
      )}
    </div>
  )
}
