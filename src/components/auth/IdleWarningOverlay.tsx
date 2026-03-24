'use client'
import React from 'react'
import { useApp } from '../../context/AppContext'
import { Clock, LogOut, ShieldAlert } from 'lucide-react'

export default function IdleWarningOverlay() {
  const { idleCountdown, resetIdle, logout } = useApp()

  if (idleCountdown === null) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="card" style={{ maxWidth: 360, width: '100%', padding: 32, textAlign: 'center', border: '2px solid var(--warning)' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--warning)'
        }}>
          <ShieldAlert size={28} />
        </div>
        
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Idle Timeout Warning</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24 }}>
          You have been inactive for a while. You will be logged out in:
        </p>

        <div style={{ 
          fontSize: 48, fontWeight: 900, color: 'var(--warning)', 
          fontFamily: 'var(--mono)', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <Clock size={36} />
          {idleCountdown}s
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className="btn btn-secondary" 
            style={{ flex: 1 }}
            onClick={() => logout()}
          >
            <LogOut size={16} style={{ marginRight: 6 }} />
            Sign Out
          </button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }}
            onClick={() => resetIdle()}
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  )
}
