'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, fmtDate, avatarColor, initials } from '../../lib/utils'
import { Leave, LeaveType } from '../../types'
import { Plane, CalendarDays, Users, Plus, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

const LEAVE_TYPES: { value: LeaveType; label: string; icon: string }[] = [
  { value: 'annual', label: 'Annual Leave', icon: '🌴' },
  { value: 'sick', label: 'Sick Leave', icon: '🤒' },
  { value: 'maternity', label: 'Maternity', icon: '🤱' },
  { value: 'paternity', label: 'Paternity', icon: '👶' },
  { value: 'compassionate', label: 'Compassionate', icon: '🕊️' },
  { value: 'study', label: 'Study Leave', icon: '📚' },
  { value: 'unpaid', label: 'Unpaid Leave', icon: '⏸️' },
  { value: 'other', label: 'Other', icon: '📌' },
]

function typeMeta(t: string) {
  return LEAVE_TYPES.find(x => x.value === t) || { value: t, label: t, icon: '📌' }
}

function leaveIsActive(l: Leave, ref: Date = new Date()): boolean {
  const today = ref.toISOString().slice(0, 10)
  return l.status === 'approved' && l.fromDate <= today && l.toDate >= today
}

// Mon–Sun boundaries for "this week" overlap
function weekBounds(ref: Date = new Date()): { start: string; end: string } {
  const d = new Date(ref)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.round((b - a) / 86400000) + 1
}

export default function LeavePage() {
  const { user, staff, leaves, saveLeave, deleteLeave } = useApp()
  const isAdmin = user?.role === 'admin'

  const [form, setForm] = useState({
    staffId: '',
    type: 'annual' as LeaveType,
    fromDate: '',
    toDate: '',
    reason: '',
  })
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<{ open: boolean; action: () => void; message: string }>({ open: false, action: () => {}, message: '' })

  // Staff log their own; admin logs on behalf of selected staff
  function submitLeave() {
    const targetId = isAdmin ? form.staffId : user!.id
    if (!targetId) { toast.error('Select a staff member'); return }
    if (!form.fromDate || !form.toDate) { toast.error('From and To dates required'); return }
    if (form.fromDate > form.toDate) { toast.error('From date must be before To date'); return }

    const target = staff.find(s => s.id === targetId)
    if (!target) { toast.error('Staff not found'); return }

    const now = new Date().toISOString()
    const leave: Leave = {
      id: genId(),
      staffId: targetId,
      staffName: target.name,
      type: form.type,
      fromDate: form.fromDate,
      toDate: form.toDate,
      reason: form.reason.trim() || undefined,
      // Auto-logged — instantly active, no approval workflow (HR=Admin model)
      status: 'approved',
      approvedBy: user!.name,
      approvedAt: now,
      leadId: target.leadId || undefined,
      createdAt: now,
    }
    saveLeave(leave)
    setForm({ staffId: '', type: 'annual', fromDate: '', toDate: '', reason: '' })
    toast.success(isAdmin ? `Leave logged for ${target.name}` : 'Leave logged')
  }

  function removeLeave(l: Leave) {
    setConfirm({
      open: true,
      message: `Delete ${typeMeta(l.type).label} for ${l.staffName} (${l.fromDate} → ${l.toDate})?`,
      action: () => { deleteLeave(l.id); toast.success('Leave record deleted') },
    })
  }

  const visibleLeaves = useMemo(() => {
    const list = isAdmin ? leaves : leaves.filter(l => l.staffId === user?.id)
    const q = search.trim().toLowerCase()
    return list
      .filter(l => !q || l.staffName.toLowerCase().includes(q) || typeMeta(l.type).label.toLowerCase().includes(q))
      .sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''))
  }, [leaves, isAdmin, user?.id, search])

  const activeCount = visibleLeaves.filter(l => leaveIsActive(l)).length

  const week = useMemo(() => weekBounds(), [])
  const thisWeekCount = useMemo(
    () => visibleLeaves.filter(l => l.fromDate <= week.end && l.toDate >= week.start).length,
    [visibleLeaves, week]
  )
  const awayThisWeek = useMemo(() => visibleLeaves.filter(l => leaveIsActive(l)), [visibleLeaves])

  /* ── shared style fragments ── */
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }
  const fieldStyle: React.CSSProperties = {
    width: '100%', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)',
    border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '9px 11px', outline: 'none',
  }

  const stats: { label: string; value: number; sub: string; color: string; icon: React.ReactNode }[] = [
    { label: 'On leave now', value: activeCount, sub: 'Currently active', color: 'var(--brand)', icon: <Plane size={16} /> },
    { label: 'Total records', value: visibleLeaves.length, sub: isAdmin ? 'Across all staff' : 'Your leave history', color: 'var(--ink)', icon: <CalendarDays size={16} /> },
    { label: isAdmin ? 'Staff on leave' : 'This week', value: isAdmin ? awayThisWeek.length : thisWeekCount, sub: isAdmin ? 'Active right now' : 'Overlapping this week', color: 'var(--info)', icon: <Users size={16} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Heading */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>Leave &amp; Absence</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
          {isAdmin
            ? 'Log leave on behalf of staff. Staff on active leave are not flagged as non-compliant.'
            : 'Log your leave so the platform does not flag you as non-compliant during your absence.'}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--sh-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{s.label}</span>
              <span style={{ color: s.color, display: 'flex' }}>{s.icon}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sora)', fontSize: 30, fontWeight: 800, color: s.color, marginTop: 10, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column: form + list */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* LEFT — sticky form */}
        <div style={{ position: 'sticky', top: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {isAdmin ? 'Log leave' : 'Request leave'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
              {isAdmin ? 'Record leave on behalf of any staff member.' : 'Logged instantly — no approval needed.'}
            </p>
          </div>

          {isAdmin && (
            <div>
              <label style={labelStyle}>Staff member</label>
              <select style={fieldStyle} value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Select staff...</option>
                {[...staff].filter(s => !s.suspended).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Type</label>
            <select style={fieldStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as LeaveType })}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>From</label>
              <input type="date" style={fieldStyle} value={form.fromDate} max={form.toDate || undefined} onChange={e => setForm({ ...form, fromDate: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>To</label>
              <input type="date" style={fieldStyle} value={form.toDate} min={form.fromDate || undefined} onChange={e => setForm({ ...form, toDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Reason (optional)</label>
            <input style={fieldStyle} placeholder="e.g. Family event, medical appointment..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          </div>

          <button
            onClick={submitLeave}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
              background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 'var(--r-sm)', padding: '11px 14px', cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(12,122,55,.25)',
            }}
          >
            <Plus size={16} /> {isAdmin ? 'Log leave' : 'Request leave'}
          </button>
        </div>

        {/* RIGHT — records list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                  {isAdmin ? 'All leave records' : 'My requests'}
                </h3>
                {activeCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--tint)', borderRadius: 999, padding: '3px 9px' }}>
                    {activeCount} active now
                  </span>
                )}
              </div>
              {isAdmin && (
                <div style={{ position: 'relative', minWidth: 220 }}>
                  <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }} />
                  <input
                    placeholder="Search name or type..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...fieldStyle, paddingLeft: 32, fontSize: 13 }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleLeaves.length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--ink-3)', fontSize: 13 }}>No leave records yet</div>
              )}
              {visibleLeaves.map(l => {
                const meta = typeMeta(l.type)
                const active = leaveIsActive(l)
                const days = daysBetween(l.fromDate, l.toDate)
                return (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                      borderBottom: '1px solid var(--line-2)',
                      background: active ? 'var(--tint)' : 'transparent',
                    }}
                  >
                    <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--tint)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CalendarDays size={18} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        {meta.icon} {meta.label}
                        {isAdmin && <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}> · {l.staffName}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.reason}>
                        {l.reason || '—'}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        {days} day{days === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {active
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--tint)', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>On leave now</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-tint)', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>{l.status === 'approved' ? 'Logged' : l.status}</span>}
                    </div>

                    {(isAdmin || l.staffId === user?.id) && (
                      <button
                        title="Delete"
                        onClick={() => removeLeave(l)}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Who's away this week */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Who&apos;s away this week</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>Currently on active leave</p>
            </div>
            {awayThisWeek.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)', fontSize: 13 }}>Nobody is on leave right now</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {awayThisWeek.map(l => {
                  const meta = typeMeta(l.type)
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: avatarColor(l.staffName), color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {initials(l.staffName)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{l.staffName}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{meta.icon} {meta.label}</div>
                      </div>
                      <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirm.open}
        title="Confirm Deletion"
        message={confirm.message}
        onConfirm={confirm.action}
        onCancel={() => setConfirm({ open: false, action: () => {}, message: '' })}
      />
    </div>
  )
}
