'use client'
import React, { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { useApp } from '../../context/AppContext'
import { fmtDate, timeAgo } from '../../lib/utils'
import { Check, X, ShieldAlert, Clock, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetRequestsPage() {
  const { staff, saveStaff, notify } = useApp()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'reset_requests'), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRequests(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const handleApprove = async (req: any) => {
    if (!window.confirm(`Approve password reset for ${req.userName}?`)) return
    try {
      await updateDoc(doc(db, 'staff', req.userId), {
        password: '1234',
        first_login: true,
        password_reset_pending: true,
        force_logout: true
      })
      // Update local state if needed
      saveStaff(staff.map(s => s.id === req.userId ? { ...s, password: '1234', first_login: true, password_reset_pending: true } : s))
      
      await deleteDoc(doc(db, 'reset_requests', req.id))
      notify(req.userId, '🔒 Your password has been reset to "1234" by Admin. Please change it on next login.', 'info')
      toast.success('Reset request approved')
    } catch (e) {
      toast.error('Failed to approve request')
    }
  }

  const handleReject = async (id: string) => {
    if (!window.confirm('Delete this request?')) return
    try {
      await deleteDoc(doc(db, 'reset_requests', id))
      toast.success('Request removed')
    } catch (e) {
      toast.error('Failed to remove request')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🔐 Password Reset Queue</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          Manage incoming password recovery requests from staff members
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Staff Member</th>
                <th>Email</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>💎</div>
                    <div style={{ fontWeight: 600 }}>No pending requests</div>
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        {timeAgo(req.timestamp)}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{req.userName}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={12} />
                        {req.email}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-yellow">Pending</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={() => handleApprove(req)}
                          title="Reset to 1234"
                        >
                          <Check size={14} style={{ marginRight: 4 }} /> Approve
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleReject(req.id)}
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ 
        background: 'var(--bg-elevated)', 
        border: '1px solid var(--border)', 
        borderRadius: 12, 
        padding: 16, 
        display: 'flex', 
        gap: 12,
        alignItems: 'flex-start'
      }}>
        <ShieldAlert size={20} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          <strong>Admin Policy:</strong> Approving a request will immediately terminate the user's active session, reset their password to <code>1234</code>, and force a mandatory password change on their next sign-in.
        </div>
      </div>
    </div>
  )
}
