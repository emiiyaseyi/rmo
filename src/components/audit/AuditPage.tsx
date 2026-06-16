'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText, LogIn, LogOut, CheckCircle2, XCircle, Send, PlusCircle,
  Pencil, Trash2, ShieldAlert, UserPlus, UserCog, UserMinus, Users,
  Unlock, FolderPlus, FolderCog, FolderMinus, Settings, Upload, Activity,
  ChevronDown, Download, Search, Clock
} from 'lucide-react'
import { exportCSV, avatarColor, initials } from '../../lib/utils'
import { useApp } from '../../context/AppContext'

interface AuditLog {
  id: string;
  action: string;
  detail?: string;
  userId?: string;
  userName?: string;
  performedBy?: string;
  targetId?: string;
  device?: string;
  ipAddress?: string;
  timestamp: string;
  metadata?: any;
}

const PAGE_SIZE = 50

// Raw action code -> readable phrase (verb + object)
const ACTION_LABELS: Record<string, string> = {
  submit: 'submitted a timesheet',
  login: 'signed in',
  logout: 'signed out',
  approve: 'approved an entry',
  reject: 'rejected an entry',
  override: 'overrode an entry',
  import: 'imported data',
  password_reset: 'reset a password',
  force_logout: 'forced a sign-out',
  settings_change: 'updated system settings',
  delete: 'deleted a record',
  restore: 'restored a record',
  // Legacy / extended action codes
  APPROVAL_APPROVED: 'approved a timesheet entry',
  APPROVAL_REJECTED: 'rejected a timesheet entry',
  ADD_ENTRY: 'added a timesheet entry',
  EDIT_ENTRY: 'edited a timesheet entry',
  DELETE_ENTRY: 'deleted a timesheet entry',
  ADMIN_OVERRIDE: 'overrode a timesheet entry',
  ADD_STAFF: 'added a staff member',
  EDIT_STAFF: 'edited a staff member',
  DELETE_STAFF: 'deleted staff member(s)',
  BULK_SUSPEND: 'suspended staff member(s)',
  BULK_UNSUSPEND: 'unsuspended staff member(s)',
  BULK_EDIT_STAFF: 'bulk edited staff member(s)',
  ACCOUNT_UNLOCK: 'unlocked an account',
  FORCE_LOGOUT: 'forced a sign-out',
  BULK_IMPORT_ENTRIES: 'bulk imported timesheet entries',
  create_staff: 'added a staff member',
  update_staff: 'edited a staff member',
  delete_staff: 'deleted a staff member',
  update_entry: 'edited a timesheet entry',
  create_entry: 'added a timesheet entry',
  delete_entry: 'deleted a timesheet entry',
  project_create: 'created a project',
  project_update: 'updated a project',
  project_delete: 'deleted a project',
  project_bulk_import: 'bulk imported projects',
}

function prettyAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  return (action || 'performed an action').replace(/[_-]+/g, ' ').toLowerCase()
}

type Category = 'approve' | 'reject' | 'delete' | 'submit' | 'create' | 'edit' | 'auth' | 'settings' | 'import' | 'other'

function categoryOf(action: string): Category {
  const a = (action || '').toLowerCase()
  if (a.includes('login')) return 'auth'
  if (a.includes('logout')) return 'auth'
  if (a.includes('approv')) return 'approve'
  if (a.includes('reject')) return 'reject'
  if (a.includes('delete') || a.includes('suspend')) return 'delete'
  if (a.includes('submit')) return 'submit'
  if (a.includes('create') || a.includes('add')) return 'create'
  if (a.includes('edit') || a.includes('update') || a.includes('override')) return 'edit'
  if (a.includes('setting')) return 'settings'
  if (a.includes('import')) return 'import'
  return 'other'
}

const CAT_META: Record<Category, { color: string; Icon: React.ComponentType<any> }> = {
  approve: { color: '#10B981', Icon: CheckCircle2 },
  reject: { color: '#EF4444', Icon: XCircle },
  delete: { color: '#EF4444', Icon: Trash2 },
  submit: { color: '#3B82F6', Icon: Send },
  create: { color: '#10B981', Icon: PlusCircle },
  edit: { color: '#F59E0B', Icon: Pencil },
  auth: { color: '#06B6D4', Icon: LogIn },
  settings: { color: '#8B5CF6', Icon: Settings },
  import: { color: '#8B5CF6', Icon: Upload },
  other: { color: 'var(--ink-3)', Icon: Activity },
}

function iconForAction(action: string): React.ComponentType<any> {
  const a = (action || '').toLowerCase()
  if (a.includes('login')) return LogIn
  if (a.includes('logout')) return LogOut
  if (a.includes('staff') && (a.includes('add') || a.includes('create'))) return UserPlus
  if (a.includes('staff') && (a.includes('edit') || a.includes('update'))) return UserCog
  if (a.includes('staff') && a.includes('delete')) return UserMinus
  if (a.includes('suspend') || a.includes('bulk')) return Users
  if (a.includes('unlock')) return Unlock
  if (a.includes('override')) return ShieldAlert
  if (a.includes('project') && a.includes('create')) return FolderPlus
  if (a.includes('project') && a.includes('update')) return FolderCog
  if (a.includes('project') && a.includes('delete')) return FolderMinus
  return CAT_META[categoryOf(action)].Icon
}

export default function AuditPage() {
  const { staff, entries } = useApp()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  // Resolve a targetId to a human-readable name: staff member, or the staff
  // who owns a timesheet entry, or a name carried in metadata, else the raw id.
  const resolveTarget = useCallback((log: AuditLog): string => {
    const meta = log.metadata || {}
    if (meta.targetName) return meta.targetName
    if (meta.name) return meta.name
    const id = log.targetId
    if (!id || id === 'unknown') return ''
    const s = staff.find(x => x.id === id)
    if (s) return s.name
    const e = entries.find(x => x.id === id)
    if (e) return e.staffName || (staff.find(x => x.id === e.staffId)?.name ?? '')
    if (meta.staffId) {
      const ms = staff.find(x => x.id === meta.staffId)
      if (ms) return ms.name
    }
    return id
  }, [staff, entries])

  const performerOf = (log: AuditLog) => log.performedBy || log.userName || 'System'

  const businessLogs = useMemo(
    () => logs.filter(l => l.action !== 'login' && l.action !== 'logout'),
    [logs]
  )

  const filtered = useMemo(() => businessLogs.filter(l => {
    if (search) {
      const q = search.toLowerCase()
      const who = performerOf(l).toLowerCase()
      const act = `${l.action ?? ''} ${prettyAction(l.action)}`.toLowerCase()
      const target = resolveTarget(l).toLowerCase()
      if (!who.includes(q) && !act.includes(q) && !target.includes(q)) return false
    }
    if (filterAction && categoryOf(l.action) !== filterAction) return false
    if (filterDate && !l.timestamp?.startsWith(filterDate)) return false
    return true
  }), [businessLogs, search, filterAction, filterDate, resolveTarget])

  const actionCategories = useMemo(
    () => Array.from(new Set(businessLogs.map(l => categoryOf(l.action)))) as Category[],
    [businessLogs]
  )
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  async function handleExport() {
    const res = await fetch(`/api/audit-logs?limit=200&offset=0`)
    const data = await res.json()
    const allLogs: AuditLog[] = data.logs ?? []
    exportCSV(allLogs.map(l => ({
      Time: l.timestamp,
      User: performerOf(l),
      Action: prettyAction(l.action),
      Target: resolveTarget(l),
      Device: l.device ?? '',
    })), 'audit_trail.csv')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
            <FileText size={20} style={{ color: 'var(--brand)' }} /> Audit Trail
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
            Who did what, to whom, and when. {total} business events logged (sign-in/out excluded).
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }} />
          <input
            className="form-input"
            placeholder="Search by user, action, or target…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 32 }}
          />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All Actions</option>
          {actionCategories.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
        </select>
        <input className="form-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {loading ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--ink-3)',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)'
        }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 48, textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)'
        }}>
          <FileText size={32} style={{ color: 'var(--ink-4)' }} />
          <div style={{ marginTop: 8, fontWeight: 700, color: 'var(--ink-2)' }}>No audit logs match</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((l, i) => {
            const cat = categoryOf(l.action)
            const { color } = CAT_META[cat]
            const Icon = iconForAction(l.action)
            const who = performerOf(l)
            const target = resolveTarget(l)
            const meta = l.metadata || {}
            const key = l.id || String(i)
            const isOpen = !!expanded[key]
            const ts = l.timestamp ? new Date(l.timestamp) : null
            const hasDetail = !!(l.device || l.ipAddress || (meta && Object.keys(meta).length))

            return (
              <div key={key} style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-lg)',
                boxShadow: 'var(--sh-sm)',
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Action category icon */}
                  <div style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    color,
                  }}>
                    <Icon size={17} />
                  </div>

                  {/* Sentence */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      {/* Performer avatar chip */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        verticalAlign: 'middle', marginRight: 2,
                      }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: avatarColor(who), color: '#fff',
                          fontSize: 9, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>{initials(who)}</span>
                        <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{who}</strong>
                      </span>
                      {' '}{prettyAction(l.action)}
                      {target && (
                        <>
                          {' '}<span style={{ color: 'var(--ink-4)' }}>·</span>{' '}
                          <strong style={{ color: 'var(--brand)', fontWeight: 700 }}>{target}</strong>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                        <Clock size={11} /> {ts ? ts.toLocaleString() : '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{l.action}</span>
                      {hasDetail && (
                        <button
                          onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 11, color: 'var(--ink-3)', padding: 0,
                          }}
                        >
                          <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                          {isOpen ? 'Hide details' : 'Details'}
                        </button>
                      )}
                    </div>

                    {isOpen && hasDetail && (
                      <div style={{
                        marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line)',
                        fontSize: 11.5, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4,
                      }}>
                        {l.device && <div><span style={{ color: 'var(--ink-4)' }}>Device:</span> {l.device}</div>}
                        {l.ipAddress && <div><span style={{ color: 'var(--ink-4)' }}>IP:</span> {l.ipAddress}</div>}
                        {l.detail && <div><span style={{ color: 'var(--ink-4)' }}>Note:</span> {l.detail}</div>}
                        {meta && Object.keys(meta).length > 0 && (
                          <pre style={{
                            margin: 0, fontFamily: 'var(--mono)', fontSize: 10.5,
                            color: 'var(--ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            background: 'var(--bg-subtle, transparent)',
                          }}>{JSON.stringify(meta, null, 2)}</pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => fetchLogs(Math.max(0, offset - PAGE_SIZE))}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Page {currentPage} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={offset + PAGE_SIZE >= total} onClick={() => fetchLogs(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </div>
  )
}
