'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { initials, avatarColor, local } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Bell, Menu, Sun, Moon, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import PasswordChangeModal from '../auth/PasswordChangeModal'
import IdleWarningOverlay from '../auth/IdleWarningOverlay'


interface NavItem {
  id: string;
  label: string;
  icon: string;
  roles: string[];
  badge?: string;
}

function getNavItems(role: string): NavItem[] {
  const all: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', roles: ['staff', 'owner', 'admin'] },
    { id: 'timesheet', label: 'Timesheet', icon: '📋', roles: ['staff', 'owner', 'admin'] },
    { id: 'approvals', label: 'Approvals', icon: '✅', roles: ['owner', 'admin'], badge: 'approvals' },
    { id: 'delegation', label: 'Delegation', icon: '🤝', roles: ['owner', 'admin'] },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', roles: ['staff', 'owner', 'admin'] },
    { id: 'messages', label: 'Messages', icon: '💬', roles: ['staff', 'owner', 'admin'], badge: 'messages' },
    { id: 'analytics', label: 'Analytics', icon: '📊', roles: ['owner', 'admin'] },
    { id: 'staff', label: 'Staff', icon: '👥', roles: ['admin'] },
    { id: 'org_chart', label: 'Org Chart', icon: '🗂️', roles: ['admin'] },
    { id: 'audit', label: 'Audit Trail', icon: '📝', roles: ['admin'] },
    { id: 'reset_queue', label: 'Reset Queue', icon: '🔐', roles: ['admin'] },
    { id: 'backend', label: 'Backend', icon: '🔧', roles: ['admin'] },

    { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
    { id: 'profile', label: 'My Profile', icon: '👤', roles: ['staff', 'team_lead', 'admin', 'super_admin'] },
    { id: 'help', label: 'Help & FAQ', icon: '❓', roles: ['staff', 'team_lead', 'admin', 'super_admin'] },
  ]
  return all.filter(n => n.roles.includes(role))
}

interface LayoutProps {
  page: string;
  setPage: (page: string) => void;
  children: React.ReactNode;
}

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { user, logout, unreadCount, notifications, markAllRead, online, darkMode, toggleDark, pendingApprovals, messages, settings, showPasswordChange } = useApp()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  // Close sidebar on navigation (mobile)
  useEffect(() => { if (isMobile) setSidebarOpen(false) }, [page, isMobile])
  // Close sidebar when going desktop
  useEffect(() => { if (!isMobile) setSidebarOpen(false) }, [isMobile])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navItems = getNavItems(user?.role || 'staff')
  const pendingCount = pendingApprovals().length
  const unreadMsg = (messages || []).filter(m => m.recipientId === user?.id && !(m.read || []).includes(user?.id || '')).length
  const logoUrl = local.get('logo_url', '')
  const appName = settings?.app_name || 'DSN RMS'
  const ann = settings?.announcement
  const annActive = ann && ann.message && (!ann.expires || new Date(ann.expires).getTime() > Date.now())

  const SIDEBAR_W = 260

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', flexDirection: 'column', fontFamily: 'var(--font-poppins)' }}>

      {/* Announcement banner */}
      {annActive && (
        <div style={{
          background: ann.color || 'var(--brand-primary)', color: 'white',
          padding: '8px 20px', fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--font-jakarta)',
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
          flexShrink: 0, zIndex: 200,
        }}>
          <span>{ann.icon}</span><span>{ann.message}</span>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }}
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: SIDEBAR_W,
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0, zIndex: 100,
          ...(isMobile ? {
            position: 'fixed', top: 0, bottom: 0, left: 0,
            transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          } : {
            position: 'relative',
            transform: 'none',
          })
        }}>
          <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={logoUrl || "/dsn.png"} alt="Logo" style={{ height: 48, objectFit: 'contain' }} />
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {navItems.map(item => {
              const badge = item.badge === 'approvals' ? pendingCount : item.badge === 'messages' ? unreadMsg : 0
              const active = page === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                    background: active ? 'var(--accent-subtle)' : 'transparent',
                    fontSize: 13, fontWeight: 500, marginBottom: 2,
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{badge}</span>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User card */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div
              onClick={() => setPage('profile')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="avatar avatar-sm" style={{ background: avatarColor(user?.name || ''), fontSize: 10, flexShrink: 0 }}>
                {user?.photo ? <img src={user.photo} alt="" /> : initials(user?.name || '')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize' }}>{user?.role}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Topbar */}
          <header style={{
            height: 56, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {isMobile && (
                <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>
              )}
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {navItems.find(n => n.id === page)?.icon} {navItems.find(n => n.id === page)?.label || 'Dashboard'}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* Online indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: online ? 'var(--success)' : 'var(--danger)' }}>
                {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                {!isMobile && <span>{online ? 'Online' : 'Offline'}</span>}
              </div>

              {/* Dark mode */}
              <button className="btn btn-icon btn-secondary btn-sm" onClick={toggleDark} title="Toggle theme">
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Notifications */}
              <div style={{ position: 'relative' }} ref={notifRef}>
                <button className="btn btn-icon btn-secondary btn-sm" style={{ position: 'relative' }} onClick={() => { setNotifOpen(v => !v); setUserMenuOpen(false) }}>
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--danger)', color: 'white', fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="dropdown-menu" style={{ right: 0, minWidth: 300, maxHeight: 380, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>Notifications</span>
                      {unreadCount > 0 && <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={markAllRead}>Mark all read</button>}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No notifications</div>
                    ) : (notifications || []).slice(0, 20).map(n => (
                      <div key={n.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: n.read ? 'transparent' : 'var(--accent-subtle)', borderRadius: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 16 }}>{n.type === 'badge' ? '🏆' : n.type === 'approval' ? '✅' : n.type === 'rejection' ? '❌' : '🔔'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-1)' }}>{n.message}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User menu */}
              <div style={{ position: 'relative' }} ref={userRef}>
                <button
                  onClick={() => { setUserMenuOpen(v => !v); setNotifOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer' }}
                >
                  <div className="avatar avatar-sm" style={{ background: avatarColor(user?.name || ''), fontSize: 10 }}>
                    {user?.photo ? <img src={user.photo} alt="" /> : initials(user?.name || '')}
                  </div>
                  {!isMobile && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{user?.name?.split(' ')[0]}</span>}
                  <ChevronDown size={12} color="var(--text-3)" />
                </button>
                {userMenuOpen && (
                  <div className="dropdown-menu" style={{ right: 0 }}>
                    <div className="dropdown-item" onClick={() => { setPage('profile'); setUserMenuOpen(false) }}>👤 My Profile</div>
                    <div className="dropdown-item" onClick={() => { setPage('settings'); setUserMenuOpen(false) }}>⚙️ Settings</div>
                    <div className="dropdown-divider" />
                    <div className="dropdown-item danger" onClick={() => { logout(); setUserMenuOpen(false) }}>🚪 Sign Out</div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 24, minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
      {user && showPasswordChange && <PasswordChangeModal />}
      <IdleWarningOverlay />
    </div>
  )
}

