'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText, LogIn, LogOut, CheckCircle2, XCircle, Send, PlusCircle,
  Pencil, Trash2, ShieldAlert, UserPlus, UserCog, UserMinus, Users,
  Unlock, FolderPlus, FolderCog, FolderMinus, Settings, Upload, Activity,
  Download, Search
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
  leave_logged: 'logged a leave record',
  leave_updated: 'updated a leave record',
  leave_deleted: 'deleted a leave record',
  badge_granted: 'earned a badge',
  holiday_added: 'added a public holiday',
  holiday_deleted: 'deleted a public holiday',
  password_reset_approved: 'approved a password reset',
  password_reset_declined: 'declined a password reset',
  reward_redeemed: 'redeemed a reward',
  reward_fulfilled: 'fulfilled a reward redemption',
  points_recalculated: 'recalculated all points',
  backup_downloaded: 'downloaded a data backup',
  BULK_IMPORT_STAFF: 'bulk imported staff',
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

// Token-based pill colors per category (bg / fg using design tokens)
const CAT_PILL: Record<Category, { bg: string; fg: string }> = {
  approve: { bg: 'var(--tint)', fg: 'var(--brand)' },
  reject: { bg: 'var(--danger-tint)', fg: 'var(--danger)' },
  delete: { bg: 'var(--danger-tint)', fg: 'var(--danger)' },
  submit: { bg: 'var(--info-tint)', fg: 'var(--info)' },
  create: { bg: 'var(--info-tint)', fg: 'var(--info)' },
  edit: { bg: 'var(--warn-tint)', fg: 'var(--warn)' },
  auth: { bg: 'var(--elev)', fg: 'var(--ink-2)' },
  settings: { bg: 'var(--warn-tint)', fg: 'var(--warn)' },
  import: { bg: 'var(--elev)', fg: 'var(--ink-2)' },
  other: { bg: 'var(--elev)', fg: 'var(--ink-2)' },
}

// Build a compact inline metadata summary from the most useful fields.
function metaSummary(log: AuditLog): string {
  const meta = log.metadata || {}
  const parts: string[] = []
  const push = (k: string, v: any) => {
    if (v === undefined || v === null || v === '') return
    parts.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  }
  // Preferred fields, in a sensible order
  push('week', meta.weekKey ?? meta.week)
  push('hours', meta.hours ?? meta.totalHours)
  push('reason', meta.reason ?? meta.note ?? log.detail)
  push('status', meta.status)
  push('project', meta.project ?? meta.projectName)
  push('count', meta.count)
  // Fill with any other primitive metadata fields we haven't covered yet
  const seen = new Set(['weekKey', 'week', 'hours', 'totalHours', 'reason', 'note', 'status', 'project', 'projectName', 'count', 'targetName', 'name', 'staffId'])
  for (const [k, v] of Object.entries(meta)) {
    if (seen.has(k)) continue
    if (v && typeof v === 'object') continue
    push(k, v)
    if (parts.length >= 6) break
  }
  return parts.join(' · ')
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
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-sm)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 130 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 180 }} />
                <col />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Time', 'User', 'Action', 'Target', 'Details', 'Device'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 14px',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em',
                      textTransform: 'uppercase', color: 'var(--ink-4)',
                      borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => {
                  const cat = categoryOf(l.action)
                  const pill = CAT_PILL[cat]
                  const Icon = iconForAction(l.action)
                  const who = performerOf(l)
                  const target = resolveTarget(l)
                  const meta = l.metadata || {}
                  const key = l.id || String(i)
                  const ts = l.timestamp ? new Date(l.timestamp) : null
                  const targetResolved = !!(meta.targetName || meta.name ||
                    (l.targetId && staff.some(s => s.id === l.targetId)) ||
                    (l.targetId && entries.some(e => e.id === l.targetId)) ||
                    (meta.staffId && staff.some(s => s.id === meta.staffId)))
                  const summary = metaSummary(l)
                  const deviceStr = [l.device, l.ipAddress].filter(Boolean).join(' · ')
                  const fullMeta = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''

                  return (
                    <tr
                      key={key}
                      style={{ borderBottom: '1px solid var(--line-2)', transition: 'background .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* TIME */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {ts ? (
                          <>
                            <div>{ts.toLocaleDateString()}</div>
                            <div style={{ color: 'var(--ink-4)', fontSize: 11 }}>{ts.toLocaleTimeString()}</div>
                          </>
                        ) : '—'}
                      </td>

                      {/* USER */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: avatarColor(who), color: '#fff',
                            fontSize: 9.5, fontWeight: 800,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>{initials(who)}</span>
                          <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
                        </span>
                      </td>

                      {/* ACTION */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 8px', borderRadius: 'var(--r-sm)',
                          background: pill.bg, color: pill.fg,
                          fontSize: 12, fontWeight: 600, maxWidth: '100%',
                        }} title={l.action}>
                          <Icon size={13} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prettyAction(l.action)}</span>
                        </span>
                      </td>

                      {/* TARGET */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', fontSize: 13 }}>
                        {target ? (
                          <span style={{
                            color: targetResolved ? 'var(--ink-2)' : 'var(--ink-4)',
                            fontFamily: targetResolved ? undefined : 'var(--mono)',
                            fontSize: targetResolved ? 13 : 11.5,
                            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }} title={target}>{target}</span>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>

                      {/* DETAILS */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        {summary ? (
                          <span
                            title={fullMeta || summary}
                            style={{
                              color: 'var(--ink-3)', fontSize: 12,
                              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              cursor: fullMeta ? 'help' : 'default',
                            }}
                          >{summary}</span>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>

                      {/* DEVICE */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        {deviceStr ? (
                          <span style={{
                            color: 'var(--ink-4)', fontSize: 11,
                            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }} title={deviceStr}>{deviceStr}</span>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
