'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { genId } from '../../lib/utils'
import { Staff, Delegation } from '../../types'
import toast from 'react-hot-toast'

export default function DelegationPage() {
  const { user, staff, delegations, saveDelegations, notify } = useApp()
  const [form, setForm] = useState({ delegateeId: '', from: '', until: '', reason: '' })

  const myDelegations = delegations.filter(d => d.delegatorId === user?.id)
  const delegatedToMe = delegations.filter(d => d.delegateeId === user?.id && d.active && new Date(d.until).getTime() > Date.now())

  const eligibleDelegatees = staff.filter(s =>
    s.id !== user?.id &&
    !s.suspended &&
    (['team_lead', 'admin'].includes(s.role))
  )

  function createDelegation(e: React.FormEvent) {
    e.preventDefault()
    if (!form.delegateeId || !form.until) { toast.error('Select delegate and end date'); return }
    if (new Date(form.until).getTime() <= Date.now()) { toast.error('End date must be in the future'); return }

    // Deactivate existing active delegation
    const updated = delegations.map(d => d.delegatorId === user?.id && d.active ? { ...d, active: false } : d)

    const newDel: Delegation = {
      id: genId(),
      delegatorId: user?.id || '',
      delegatorName: user?.name || '',
      delegateeId: form.delegateeId,
      delegateeName: staff.find(s => s.id === form.delegateeId)?.name || '',
      from: form.from || new Date().toISOString().slice(0, 10),
      until: form.until,
      reason: form.reason,
      active: true,
      createdAt: new Date().toISOString(),
    }

    saveDelegations([...updated, newDel])
    notify(form.delegateeId, `${user?.name} has delegated approval authority to you until ${new Date(form.until).toLocaleDateString()}`, 'info')
    setForm({ delegateeId: '', from: '', until: '', reason: '' })
    toast.success('Delegation created')
  }

  function revoke(id: string) {
    if (!window.confirm('Revoke this delegation?')) return
    const del = delegations.find(d => d.id === id)
    saveDelegations(delegations.map(d => d.id === id ? { ...d, active: false, revokedAt: new Date().toISOString() } : d))
    if (del) notify(del.delegateeId, `${user?.name} has revoked their approval delegation`, 'info')
    toast.success('Delegation revoked')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🤝 Approval Delegation</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          Delegate your approval authority to another lead while you're away
        </p>
      </div>

      {/* Delegated to me notice */}
      {delegatedToMe.length > 0 && (
        <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔑 You have delegated authority from:</div>
          {delegatedToMe.map(d => (
            <div key={d.id} style={{ fontSize: 13, color: 'var(--text-2)' }}>
              <strong>{d.delegatorName}</strong> — until {new Date(d.until).toLocaleDateString()}
              {d.reason && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>({d.reason})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Create delegation */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 16 }}>Create New Delegation</div>
        <form onSubmit={createDelegation} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Delegate To *</label>
            <select className="form-select" value={form.delegateeId} onChange={e => setForm(f => ({ ...f, delegateeId: e.target.value }))} required>
              <option value="">Select a team lead or admin…</option>
              {eligibleDelegatees.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role} · {s.department || 'No dept'})</option>
              ))}
            </select>
            <span className="form-hint">Only team leads and admins can receive delegated authority</span>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input className="form-input" type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Until Date *</label>
              <input className="form-input" type="date" value={form.until} onChange={e => setForm(f => ({ ...f, until: e.target.value }))} required />
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
        <div style={{ fontWeight: 700, marginBottom: 12 }}>My Delegation History</div>
        {myDelegations.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">🤝</div>
            <div className="empty-state-title">No delegations created</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Delegated To</th><th>From</th><th>Until</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {[...myDelegations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(d => {
                    const expired = new Date(d.until).getTime() < Date.now()
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{d.delegateeName}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.from || '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.until}</td>
                        <td style={{ color: 'var(--text-3)' }}>{d.reason || '—'}</td>
                        <td>
                          <span className={`badge badge-${d.active && !expired ? 'green' : expired ? 'gray' : 'red'}`}>
                            {d.active && !expired ? 'Active' : expired ? 'Expired' : 'Revoked'}
                          </span>
                        </td>
                        <td>
                          {d.active && !expired && (
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
  )
}
