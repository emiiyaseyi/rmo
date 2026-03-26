'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, fmtDate } from '../../lib/utils'
import { Staff, ApprovalDelegation } from '../../types'
import toast from 'react-hot-toast'

export default function DelegationPage() {
  const { user, staff, approvalDelegations, saveApprovalDelegations, notify, projects } = useApp()
  const [form, setForm] = useState({
    delegateId: '',
    startDate: '',
    endDate: '',
    reason: '',
    scope: 'all' as 'all' | 'project',
    projectId: ''
  })

  const now = new Date()
  const myDelegations = (approvalDelegations || []).filter(d => d.taskOwnerId === user?.id)
  const delegatedToMe = (approvalDelegations || []).filter(d =>
    d.delegateId === user?.id &&
    d.isActive &&
    new Date(d.startDate) <= now &&
    new Date(d.endDate) >= now
  )

  // Debug logging
  React.useEffect(() => {
    console.log('Approval Delegations:', approvalDelegations)
    console.log('My Delegations:', myDelegations)
    console.log('User ID:', user?.id)
  }, [approvalDelegations, myDelegations, user?.id])

  const eligibleDelegatees = staff.filter(s =>
    s.id !== user?.id &&
    !s.suspended &&
    (['team_lead', 'admin'].includes(s.role))
  )

  function createDelegation(e: React.FormEvent) {
    e.preventDefault()
    if (!form.delegateId || !form.endDate) { toast.error('Select delegate and end date'); return }
    if (!form.startDate) { toast.error('Select start date'); return }
    if (new Date(form.endDate).getTime() <= Date.now()) { toast.error('End date must be in the future'); return }
    if (form.scope === 'project' && !form.projectId) { toast.error('Select a project'); return }

    const delegate = staff.find(s => s.id === form.delegateId)
    if (!delegate) return

    let projectName = undefined
    if (form.scope === 'project' && form.projectId && projects) {
      const project = projects.find((p: any) => p.id === form.projectId)
      projectName = project?.name
    }

    const newDel: ApprovalDelegation = {
      id: genId(),
      taskOwnerId: user?.id || '',
      taskOwnerName: user?.name || '',
      delegateId: form.delegateId,
      delegateName: delegate.name,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
      isActive: true,
      createdAt: new Date().toISOString(),
      scope: form.scope,
      projectId: form.projectId || undefined,
      projectName
    }

    const updatedDelegations = [...(approvalDelegations || []), newDel]
    console.log('Creating delegation:', newDel)
    console.log('Updated delegations array:', updatedDelegations)
    saveApprovalDelegations(updatedDelegations)
    const scopeText = form.scope === 'project' && projectName ? ` for ${projectName}` : ''
    notify(form.delegateId, `📋 ${user?.name} has delegated approval duties${scopeText} to you from ${form.startDate} to ${form.endDate}`, 'delegation_assigned', 'Delegation Assigned', newDel.id, 'message')
    setForm({ delegateId: '', startDate: '', endDate: '', reason: '', scope: 'all', projectId: '' })
    toast.success('Delegation created successfully!')
  }

  function revoke(id: string) {
    if (!window.confirm('Revoke this delegation?')) return
    const updated = approvalDelegations.map(d =>
      d.id === id ? { ...d, isActive: false, revokedAt: new Date().toISOString() } : d
    )
    saveApprovalDelegations(updated)
    toast.success('Delegation revoked')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🤝 Approval Delegation</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            Delegate your approval authority to another lead while you're away
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {myDelegations.length} total · {delegatedToMe.length} delegated to you
        </div>
      </div>

      {/* Delegated to me notice */}
      {delegatedToMe.length > 0 && (
        <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔑 You have delegated authority from:</div>
          {delegatedToMe.map(d => (
            <div key={d.id} style={{ fontSize: 13, color: 'var(--text-2)' }}>
              <strong>{d.taskOwnerName}</strong> — until {new Date(d.endDate).toLocaleDateString()}
              {d.scope === 'project' && d.projectName && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>({d.projectName} only)</span>}
              {d.reason && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>· {d.reason}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Create delegation */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Create New Delegation</div>
          <form onSubmit={createDelegation} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Delegate To *</label>
            <select className="form-select" value={form.delegateId} onChange={e => setForm(f => ({ ...f, delegateId: e.target.value }))} required>
              <option value="">Select a team lead or admin…</option>
              {eligibleDelegatees.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role} · {s.department || 'No dept'})</option>
              ))}
            </select>
            <span className="form-hint">Only team leads and admins can receive delegated authority</span>
          </div>

          <div className="form-group">
            <label className="form-label">Delegation Scope *</label>
            <select className="form-select" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as 'all' | 'project', projectId: '' }))}>
              <option value="all">All Approvals</option>
              <option value="project">Specific Project Only</option>
            </select>
            <span className="form-hint">Choose whether to delegate all your approvals or just a specific project</span>
          </div>

          {form.scope === 'project' && (
            <div className="form-group">
              <label className="form-label">Project/Task *</label>
              <select className="form-select" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} required>
                <option value="">Select a project...</option>
                {(projects || []).filter((p: any) => p.active).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">From Date *</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Until Date *</label>
              <input className="form-input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <input className="form-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Annual leave" />
          </div>
          <button className="btn btn-primary" type="submit">Create Delegation</button>
          </form>
        </div>

        {/* My delegations */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            My Delegation History
            {approvalDelegations && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>({myDelegations.length} total)</span>}
          </div>
          {!approvalDelegations ? (
            <div className="empty-state card">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-title">Loading delegations...</div>
            </div>
          ) : myDelegations.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">🤝</div>
              <div className="empty-state-title">No delegations created</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Delegated To</th>
                      <th>Scope</th>
                      <th>From</th>
                      <th>Until</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...myDelegations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(d => {
                      const isActive = d.isActive && new Date(d.startDate) <= now && new Date(d.endDate) >= now
                      const isFuture = new Date(d.startDate) > now
                      const isPast = new Date(d.endDate) < now

                      return (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600 }}>{d.delegateName}</td>
                          <td style={{ fontSize: 12 }}>
                            {d.scope === 'project' && d.projectName ? (
                              <span className="badge badge-blue">{d.projectName}</span>
                            ) : (
                              <span style={{ color: 'var(--text-3)' }}>All Approvals</span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(d.startDate)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(d.endDate)}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{d.reason || '—'}</td>
                          <td>
                            <span className={`badge badge-${isActive ? 'green' : isFuture ? 'blue' : 'gray'}`}>
                              {isActive ? 'Active' : isFuture ? 'Scheduled' : isPast ? 'Expired' : 'Revoked'}
                            </span>
                          </td>
                          <td>
                            {isActive && (
                              <button className="btn btn-danger btn-sm" onClick={() => revoke(d.id)}>Revoke</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
