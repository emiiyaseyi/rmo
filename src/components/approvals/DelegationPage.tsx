'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, fmtDate } from '../../lib/utils'
import { Staff, ApprovalDelegation } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

export default function DelegationPage() {
  const { user, staff, approvalDelegations, saveApprovalDelegations, notify, projects } = useApp()
  const [form, setForm] = useState({
    delegateId: '',
    startDate: '',
    endDate: '',
    reason: '',
    scope: 'all' as 'all' | 'project' | 'projects',
    projectId: '',
    projectIds: [] as string[]
  })
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, action: () => void, message: string, title?: string}>({isOpen: false, action: () => {}, message: ''})

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
    s.status === 'active'
  )

  function createDelegation(e: React.FormEvent) {
    e.preventDefault()
    if (!form.delegateId || !form.endDate) { toast.error('Select delegate and end date'); return }
    if (!form.startDate) { toast.error('Select start date'); return }
    if (new Date(form.endDate).getTime() <= Date.now()) { toast.error('End date must be in the future'); return }
    if (form.scope === 'project' && !form.projectId) { toast.error('Select a project'); return }
    if (form.scope === 'projects' && form.projectIds.length === 0) { toast.error('Select at least one project'); return }

    const delegate = staff.find(s => s.id === form.delegateId)
    if (!delegate) return

    let projectName = undefined
    let projectNames: string[] = []

    if (form.scope === 'project' && form.projectId && projects) {
      const project = projects.find((p: any) => p.id === form.projectId)
      projectName = project?.name
    }

    if (form.scope === 'projects' && form.projectIds.length > 0 && projects) {
      projectNames = form.projectIds.map(id => {
        const project = projects.find((p: any) => p.id === id)
        return project?.name || ''
      }).filter(Boolean)
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
      projectName,
      projectIds: form.scope === 'projects' ? form.projectIds : undefined,
      projectNames: form.scope === 'projects' ? projectNames : undefined
    }

    const updatedDelegations = [...(approvalDelegations || []), newDel]
    console.log('Creating delegation:', newDel)
    console.log('Updated delegations array:', updatedDelegations)
    saveApprovalDelegations(updatedDelegations)

    let scopeText = ''
    if (form.scope === 'project' && projectName) {
      scopeText = ` for ${projectName}`
    } else if (form.scope === 'projects' && projectNames.length > 0) {
      scopeText = ` for ${projectNames.length} project${projectNames.length > 1 ? 's' : ''}: ${projectNames.join(', ')}`
    }

    notify(form.delegateId, `📋 ${user?.name} has delegated approval duties${scopeText} to you from ${form.startDate} to ${form.endDate}`, 'delegation_assigned', 'Delegation Assigned', newDel.id, 'message')
    setForm({ delegateId: '', startDate: '', endDate: '', reason: '', scope: 'all', projectId: '', projectIds: [] })
    toast.success('Delegation created successfully!')
  }

  function revoke(id: string) {
    setConfirmAction({
      isOpen: true,
      action: () => {
        const updated = approvalDelegations.map(d =>
          d.id === id ? { ...d, isActive: false, revokedAt: new Date().toISOString() } : d
        )
        saveApprovalDelegations(updated)
        toast.success('Delegation revoked')
      },
      message: 'Revoke this delegation?',
      title: 'Revoke Delegation'
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🤝 Approval Delegation</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            Delegate your approval authority to any staff member while you're away
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
              {d.scope === 'projects' && d.projectNames && d.projectNames.length > 0 && (
                <span style={{ color: 'var(--accent)', marginLeft: 8 }}>({d.projectNames.length} project{d.projectNames.length > 1 ? 's' : ''}: {d.projectNames.join(', ')})</span>
              )}
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
            <span className="form-hint">Any active staff member can receive delegated authority</span>
          </div>

          <div className="form-group">
            <label className="form-label">Delegation Scope *</label>
            <select className="form-select" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as 'all' | 'project' | 'projects', projectId: '', projectIds: [] }))}>
              <option value="all">All Approvals</option>
              <option value="project">Single Project Only</option>
              <option value="projects">Multiple Projects</option>
            </select>
            <span className="form-hint">Choose whether to delegate all your approvals or specific projects</span>
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

          {form.scope === 'projects' && (
            <div className="form-group">
              <label className="form-label">Projects/Tasks *</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-card)' }}>
                {(projects || []).filter((p: any) => p.active).map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <input
                      type="checkbox"
                      id={`project-${p.id}`}
                      checked={form.projectIds.includes(p.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setForm(f => ({ ...f, projectIds: [...f.projectIds, p.id] }))
                        } else {
                          setForm(f => ({ ...f, projectIds: f.projectIds.filter(id => id !== p.id) }))
                        }
                      }}
                    />
                    <label htmlFor={`project-${p.id}`} style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>{p.name}</label>
                  </div>
                ))}
              </div>
              <span className="form-hint">{form.projectIds.length} project(s) selected</span>
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
                            ) : d.scope === 'projects' && d.projectNames && d.projectNames.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span className="badge badge-blue">{d.projectNames.length} projects</span>
                                <span style={{ fontSize: 10, color: 'var(--text-3)' }} title={d.projectNames.join(', ')}>
                                  {d.projectNames.slice(0, 2).join(', ')}{d.projectNames.length > 2 ? ` +${d.projectNames.length - 2}` : ''}
                                </span>
                              </div>
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

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.action}
        onCancel={() => setConfirmAction({isOpen: false, action: () => {}, message: ''})}
      />
    </div>
  )
}
