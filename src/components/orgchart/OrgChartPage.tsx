'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { avatarColor, initials } from '../../lib/utils'
import { Staff } from '../../types'
import { Search, Network } from 'lucide-react'

/* ---------- presentation pieces (logic unchanged) ---------- */

// Top node: director / admin — brand pill
function TopNode({ member }: { member: Staff }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--brand)', color: '#fff',
        borderRadius: 'var(--r)', padding: '14px 22px',
        boxShadow: '0 4px 14px rgba(12,122,55,.3)',
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,.2)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}
      >
        {initials(member.name)}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{member.name}</div>
        <div style={{ fontSize: 11, color: '#fff', opacity: 0.85, marginTop: 1, textTransform: 'capitalize' }}>
          {member.department || member.role.replace('_', ' ')}
        </div>
      </div>
    </div>
  )
}

// Small report row (staff under a lead)
function ReportRow({ member }: { member: Staff }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: 'var(--canvas)', borderRadius: 'var(--r-sm)',
        padding: '9px 12px',
      }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: avatarColor(member.name), color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}
      >
        {initials(member.name)}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{member.name}</div>
    </div>
  )
}

// L2 lead node (card) with its reports beneath
function LeadNode({ member, reports }: { member: Staff; reports: Staff[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasReports = reports.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={() => hasReports && setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r)', padding: '13px 16px',
          boxShadow: 'var(--sh-sm)',
          cursor: hasReports ? 'pointer' : 'default',
          minWidth: 180,
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: avatarColor(member.name), color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}
        >
          {initials(member.name)}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{member.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, textTransform: 'capitalize' }}>
            {member.department || member.role.replace('_', ' ')}
          </div>
        </div>
        {hasReports && (
          <span
            style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700,
              color: 'var(--ink-3)', background: 'var(--canvas)',
              borderRadius: 99, padding: '2px 7px',
            }}
          >
            {collapsed ? `+${reports.length}` : reports.length}
          </span>
        )}
      </div>

      {hasReports && !collapsed && (
        <>
          <div style={{ width: 2, height: 28, background: 'var(--line)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
            {reports.map(child => (
              <ReportRow key={child.id} member={child} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- horizontal connector spanning the L2 row ---------- */
function ConnectorTier({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* drop from top node */}
      <div style={{ width: 2, height: 28, background: 'var(--line)' }} />
      {/* horizontal bar + drops */}
      {count > 1 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 60 }}>
              <div
                style={{
                  height: 2, background: 'var(--line)', width: '100%',
                  // trim the ends of the horizontal bar so it spans between drops
                  ...(i === 0 ? { marginLeft: '50%', width: '50%' } : {}),
                  ...(i === count - 1 ? { width: '50%' } : {}),
                }}
              />
              <div style={{ width: 2, height: 28, background: 'var(--line)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ width: 2, height: 28, background: 'var(--line)' }} />
      )}
    </div>
  )
}

/* ===================================================================== */

export default function OrgChartPage() {
  const { staff } = useApp()
  const [viewMode, setViewMode] = useState<'role' | 'department'>('role')
  const [deptFilter, setDeptFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')

  const departments = Array.from(new Set(staff.map(s => s.department).filter((d): d is string => !!d)))
  const filtered = staff.filter(s => {
    const matchDept = !deptFilter || s.department === deptFilter
    const matchRole = !roleFilter || s.role === roleFilter
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    return matchDept && matchRole && matchSearch
  })

  // Build tree: admins at top, then team leads, then staff by leadId
  const admins = filtered.filter(s => (s.role === 'admin') && !s.suspended)
  const leads = filtered.filter(s => s.role === 'team_lead' && !s.suspended)
  const regularStaff = filtered.filter(s => s.role === 'staff' && !s.suspended)

  function getReports(leadId: string) {
    return regularStaff.filter(s => s.leadId === leadId)
  }

  // Group by department if no filter
  const deptGroups = departments.reduce((acc: Record<string, { leads: Staff[], staff: Staff[] }>, dept) => {
    const deptLeads = leads.filter(s => s.department === dept)
    const deptStaff = regularStaff.filter(s => s.department === dept && !deptLeads.find(l => l.id === s.leadId))
    if (deptLeads.length > 0 || deptStaff.length > 0) {
      acc[dept] = { leads: deptLeads, staff: deptStaff }
    }
    return acc
  }, {})

  const orphanStaff = regularStaff.filter(s => !leads.find(l => l.id === s.leadId))

  const controlSelect: React.CSSProperties = {
    height: 38, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
    background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px',
    fontSize: 13, fontFamily: 'var(--font-sora)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sora)' }}>
            <Network size={22} color="var(--brand)" /> Organogram
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Organization structure and reporting hierarchy</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* view toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--elev)', borderRadius: 'var(--r-sm)', padding: 4 }}>
            {(['role', 'department'] as const).map(mode => {
              const active = viewMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    fontSize: 12.5, fontWeight: 600, padding: '7px 14px',
                    borderRadius: 'var(--r-xs, 8px)', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sora)',
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-3)',
                    boxShadow: active ? 'var(--sh-sm)' : 'none',
                  }}
                >
                  {mode === 'role' ? 'By Role' : 'By Department'}
                </button>
              )
            })}
          </div>
          {/* search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color="var(--ink-4)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...controlSelect, width: 190, paddingLeft: 32 }}
            />
          </div>
          <select style={{ ...controlSelect, width: 160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select style={{ ...controlSelect, width: 140 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="team_lead">Team Lead</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>

      {/* Role-based view: centered hierarchical tree on a card */}
      {viewMode === 'role' && filtered.length > 0 && (
        <div
          style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)', padding: '36px 28px',
            boxShadow: 'var(--sh-sm)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          {/* Top tier: admins / directors */}
          {admins.length > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {admins.map(a => <TopNode key={a.id} member={a} />)}
            </div>
          )}

          {/* connector into the leads tier */}
          {admins.length > 0 && leads.length > 0 && <ConnectorTier count={leads.length} />}

          {/* L2 tier: team leads with their reports */}
          {leads.length > 0 && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
              {leads.map(lead => (
                <LeadNode key={lead.id} member={lead} reports={getReports(lead.id)} />
              ))}
            </div>
          )}

          {/* Staff without a lead */}
          {orphanStaff.length > 0 && (
            <div style={{ marginTop: leads.length > 0 || admins.length > 0 ? 36 : 0, width: '100%' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, textAlign: 'center' }}>
                Unassigned Staff
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {orphanStaff.map(s => (
                  <div key={s.id} style={{ minWidth: 180 }}><ReportRow member={s} /></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Department-based view */}
      {viewMode === 'department' && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Admins row on a card */}
          {admins.length > 0 && (
            <div
              style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-lg)', padding: '28px', boxShadow: 'var(--sh-sm)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>
                Administration
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {admins.map(a => <TopNode key={a.id} member={a} />)}
              </div>
            </div>
          )}

          {/* Each department on its own card */}
          {Object.entries(deptGroups).map(([dept, { leads: dLeads, staff: dStaff }]) => (
            <div
              key={dept}
              style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-lg)', padding: '28px', boxShadow: 'var(--sh-sm)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 22, paddingBottom: 12, borderBottom: '1px solid var(--line)', width: '100%', textAlign: 'center', fontFamily: 'var(--font-sora)' }}>
                {dept}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
                {dLeads.map(lead => (
                  <LeadNode key={lead.id} member={lead} reports={getReports(lead.id)} />
                ))}
                {dStaff.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                    {dStaff.map(s => <ReportRow key={s.id} member={s} />)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div
          style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)', padding: '60px 28px', boxShadow: 'var(--sh-sm)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}
        >
          <Network size={40} color="var(--ink-4)" />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>No staff to display</div>
        </div>
      )}
    </div>
  )
}
