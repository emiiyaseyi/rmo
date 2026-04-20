'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { avatarColor, initials } from '../../lib/utils'
import { Staff } from '../../types'

interface StaffNodeProps {
  member: Staff;
  reports: Staff[];
}

function StaffNode({ member, reports }: StaffNodeProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={() => reports.length > 0 && setCollapsed(!collapsed)}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 16px', textAlign: 'center',
          minWidth: 130, cursor: reports.length > 0 ? 'pointer' : 'default',
          transition: 'all 0.2s', position: 'relative',
          borderColor: (member.role === 'admin') ? 'var(--accent)' : member.role === 'team_lead' ? 'var(--purple)' : 'var(--border)',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <div className="avatar avatar-md" style={{ background: avatarColor(member.name), margin: '0 auto 8px', fontSize: 14 }}>
          {initials(member.name)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{member.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{member.department || member.role}</div>
        <div style={{ fontSize: 10, marginTop: 4 }}>
          <span style={{ 
            background: (member.role === 'admin') ? 'var(--accent-subtle)' : member.role === 'team_lead' ? 'var(--purple-bg)' : 'var(--bg-elevated)',
            color: (member.role === 'admin') ? 'var(--accent)' : member.role === 'team_lead' ? 'var(--purple)' : 'var(--text-3)', 
            padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 600 
          }}>
            {member.role.replace('_', ' ')}
          </span>
        </div>
        {reports.length > 0 && (
          <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', width: 20, height: 20, borderRadius: '50%', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {collapsed ? '+' : reports.length}
          </div>
        )}
      </div>

      {reports.length > 0 && !collapsed && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ position: 'relative', display: 'flex', gap: 16 }}>
            {/* Horizontal line */}
            {reports.length > 1 && (
              <div style={{
                position: 'absolute', top: 0,
                height: 1, background: 'var(--border)',
                left: `calc(50% / ${reports.length})`, right: `calc(50% / ${reports.length})`
              }} />
            )}
            {reports.map(child => (
              <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <StaffNode member={child} reports={[]} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🗂️ Organogram</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Organization structure and reporting hierarchy</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 8, padding: 4 }}>
            <button
              className={`btn btn-sm ${viewMode === 'role' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('role')}
              style={{ fontSize: 12 }}
            >
              By Role
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'department' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('department')}
              style={{ fontSize: 12 }}
            >
              By Department
            </button>
          </div>
          <input
            className="form-input"
            placeholder="Search staff..."
            style={{ width: 180 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" style={{ width: 150 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-select" style={{ width: 130 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="team_lead">Team Lead</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          ['Admin', 'var(--accent)'],
          ['Team Lead', 'var(--purple)'],
          ['Staff', 'var(--border)']
        ].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${color}` }} />
            <span style={{ color: 'var(--text-3)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Role-based view */}
      {viewMode === 'role' && (
        <>
          {/* Admins row */}
          {admins.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                👑 Administration
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {admins.map(a => (
                  <StaffNode key={a.id} member={a} reports={[]} />
                ))}
              </div>
            </div>
          )}

          {/* Team Leads row */}
          {leads.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                🎯 Team Leads
              </div>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                {leads.map(lead => (
                  <StaffNode key={lead.id} member={lead} reports={getReports(lead.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Staff without leads */}
          {regularStaff.filter(s => !leads.find(l => l.id === s.leadId)).length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                👥 Staff
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {regularStaff.filter(s => !leads.find(l => l.id === s.leadId)).map(s => (
                  <StaffNode key={s.id} member={s} reports={[]} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Department-based view */}
      {viewMode === 'department' && (
        <>
          {/* Admins row */}
          {admins.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Administration</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {admins.map(a => (
                  <StaffNode key={a.id} member={a} reports={[]} />
                ))}
              </div>
            </div>
          )}

          {/* Departments */}
          {Object.entries(deptGroups).map(([dept, { leads: dLeads, staff: dStaff }]) => (
            <div key={dept} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                🏢 {dept}
              </div>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                {dLeads.map(lead => (
                  <StaffNode key={lead.id} member={lead} reports={getReports(lead.id)} />
                ))}
                {/* Staff with no lead */}
                {dStaff.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {dStaff.map(s => <StaffNode key={s.id} member={s} reports={[]} />)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {filtered.length === 0 && (
        <div className="empty-state card">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No staff to display</div>
        </div>
      )}
    </div>
  )
}
