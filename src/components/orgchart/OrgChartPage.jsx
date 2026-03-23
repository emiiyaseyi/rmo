import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { avatarColor, initials } from '../../lib/utils'

function StaffNode({ member, reports }) {
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
          borderColor: member.role === 'admin' ? 'var(--accent)' : member.role === 'owner' ? 'var(--purple)' : 'var(--border)',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <div className="avatar avatar-md" style={{ background: avatarColor(member.name), margin: '0 auto 8px', fontSize: 14 }}>
          {member.photo ? <img src={member.photo} alt="" /> : initials(member.name)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{member.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{member.department || member.role}</div>
        <div style={{ fontSize: 10, marginTop: 4 }}>
          <span style={{ background: member.role === 'admin' ? 'var(--accent-subtle)' : member.role === 'owner' ? 'var(--purple-bg)' : 'var(--bg-elevated)', color: member.role === 'admin' ? 'var(--accent)' : member.role === 'owner' ? 'var(--purple)' : 'var(--text-3)', padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 600 }}>
            {member.role}
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
                left: '50%', right: '50%',
                height: 1, background: 'var(--border)',
                ...(reports.length > 1 ? { left: 'calc(50% / ' + reports.length + ')', right: 'calc(50% / ' + reports.length + ')' } : {}),
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
  const [deptFilter, setDeptFilter] = useState('')

  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))]
  const filtered = deptFilter ? staff.filter(s => s.department === deptFilter) : staff

  // Build tree: admins at top, then owners, then staff by leadId
  const admins = filtered.filter(s => s.role === 'admin' && !s.suspended)
  const owners = filtered.filter(s => s.role === 'owner' && !s.suspended)
  const regularStaff = filtered.filter(s => s.role === 'staff' && !s.suspended)

  function getReports(leadId) {
    return regularStaff.filter(s => s.leadId === leadId)
  }

  // Group by department if no filter
  const deptGroups = departments.reduce((acc, dept) => {
    const deptOwners = owners.filter(s => s.department === dept)
    const deptStaff = regularStaff.filter(s => s.department === dept && !deptOwners.find(o => o.id === s.leadId))
    if (deptOwners.length > 0 || deptStaff.length > 0) {
      acc[dept] = { owners: deptOwners, staff: deptStaff }
    }
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🗂️ Org Chart</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Department structure and reporting lines</p>
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[['Admin', 'var(--accent)'], ['Owner / Lead', 'var(--purple)'], ['Staff', 'var(--border)']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${color}` }} />
            <span style={{ color: 'var(--text-3)' }}>{label}</span>
          </div>
        ))}
      </div>

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
      {Object.entries(deptGroups).map(([dept, { owners: dOwners, staff: dStaff }]) => (
        <div key={dept} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            🏢 {dept}
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
            {dOwners.map(owner => (
              <StaffNode key={owner.id} member={owner} reports={getReports(owner.id)} />
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

      {filtered.length === 0 && (
        <div className="empty-state card">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No staff to display</div>
        </div>
      )}
    </div>
  )
}
