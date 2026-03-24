'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { initials, avatarColor, local } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Bell, Menu, Sun, Moon, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import PasswordChangeModal from '../auth/PasswordChangeModal'
import IdleWarningOverlay from '../auth/IdleWarningOverlay'
import FloatingChatWidget from '../messages/FloatingChatWidget'


interface NavItem {
  id: string;
  label: string;
  icon: string;
  roles: string[];
  badge?: string;
  isHeader?: boolean;
}

function getNavItems(role: string): NavItem[] {
  const all: NavItem[] = [
    { id: 'work_header', label: 'MY WORK', icon: '', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', roles: ['staff', 'admin', 'team_lead'] },
    { id: 'timesheet', label: 'Timesheet', icon: '📋', roles: ['staff', 'admin', 'team_lead'] },
    { id: 'leave', label: 'Request Leave', icon: '🏝️', roles: ['staff', 'team_lead', 'admin'] },
    { id: 'approvals', label: 'Approvals', icon: '✅', roles: ['admin', 'team_lead'], badge: 'approvals' },

    { id: 'team_header', label: 'TEAM', icon: '', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'analytics', label: 'Analytics', icon: '📊', roles: ['admin', 'team_lead'] },
    { id: 'delegation', label: 'Delegation', icon: '🤝', roles: ['admin', 'team_lead'] },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', roles: ['staff', 'admin', 'team_lead'] },
    { id: 'staff', label: 'Staff Directory', icon: '👥', roles: ['admin'] },
    { id: 'org_chart', label: 'Org Chart', icon: '🗂️', roles: ['admin'] },
    { id: 'audit', label: 'Audit Trail', icon: '📝', roles: ['admin'] },
    { id: 'reset_queue', label: 'Reset Queue', icon: '🔐', roles: ['admin'] },

    { id: 'connect_header', label: 'CONNECT', icon: '', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'messages', label: 'Messages', icon: '💬', roles: ['staff', 'admin', 'team_lead'], badge: 'messages' },
    { id: 'help', label: 'Help & FAQ', icon: '❓', roles: ['staff', 'team_lead', 'admin'] },
    { id: 'backend', label: 'Backend Docs', icon: '🔧', roles: ['admin'] },
  ]
  return all.filter(n => n.roles.includes(role))
}

interface LayoutProps {
  page: string;
  setPage: (page: string) => void;
  children: React.ReactNode;
}

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { user, logout, unreadCount, notifications, markAllRead, markRead, online, darkMode, toggleDark, pendingApprovals, messages, settings, showPasswordChange, announcements } = useApp()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close sidebar on navigation (mobile)
  useEffect(() => { if (isMobile) setSidebarOpen(false) }, [page, isMobile])
  // Close sidebar when going desktop
  useEffect(() => { if (!isMobile) setSidebarOpen(false) }, [isMobile])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navItems = getNavItems(user?.role || 'staff').filter(item => {
    const toggleKey = item.id === 'leaderboard' ? 'leaderboard' : 
                     item.id === 'messages' ? 'messages' :
                     item.id === 'org_chart' ? 'org_chart' :
                     item.id === 'analytics' ? 'analytics' : null
    if (toggleKey && settings?.featureToggles) {
      return (settings.featureToggles as any)[toggleKey] !== false
    }
    return true
  })

  const pendingCount = pendingApprovals().length
  const unreadMsg = (messages || []).filter(m => m.recipientId === user?.id && !(m.read || []).includes(user?.id || '')).length
  
  const branding = settings?.branding
  const logoUrl = branding?.logoBase64 || "/dsn.png"
  const appName = branding?.appName || 'DSN Timesheet'
  
  // Announcements
  const activeAnnouncements = (announcements || []).filter(a => 
    a.active && (!a.expiresAt || new Date(a.expiresAt).getTime() > Date.now())
  )

  useEffect(() => {
    if (branding?.primaryColour) {
      document.documentElement.style.setProperty('--primary', branding.primaryColour)
    }
    if (branding?.secondaryColour) {
      document.documentElement.style.setProperty('--secondary', branding.secondaryColour)
    }
  }, [branding])

  const SIDEBAR_W = 260

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', flexDirection: 'column', fontFamily: 'var(--font-poppins)' }}>

      {/* Announcements */}
      {activeAnnouncements.map(ann => (
        <div key={ann.id} style={{
          background: ann.priority === 'high' ? 'var(--danger)' : (branding?.primaryColour || 'var(--brand-primary)'), 
          color: 'white',
          padding: '8px 20px', fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--font-jakarta)',
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
          flexShrink: 0, zIndex: 200,
        }}>
          <span>📢</span><span>{ann.message}</span>
        </div>
      ))}

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
          <nav style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column' }}>
            {navItems.map((item, idx) => {
              if (item.isHeader) {
                // Peek next to see if there are any items in this section for this user
                const nextItems = navItems.slice(idx + 1)
                const sectionItems = []
                for (const next of nextItems) {
                  if (next.isHeader) break
                  sectionItems.push(next)
                }
                if (sectionItems.length === 0) return null
                
                return (
                  <div key={item.id} style={{ 
                    fontSize: 10, 
                    fontWeight: 700, 
                    color: 'var(--text-4)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em',
                    padding: '16px 12px 6px',
                    marginTop: idx === 0 ? 0 : 4
                  }}>
                    {item.label}
                  </div>
                )
              }
              
              const badge = item.badge === 'approvals' ? pendingCount : item.badge === 'messages' ? unreadMsg : 0
              const active = page === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                    background: active ? 'var(--accent-subtle)' : 'transparent',
                    fontSize: 13, fontWeight: 500, marginBottom: 2,
                    transition: 'all 0.12s ease',
                    border: active ? '1px solid var(--accent-subtle)' : '1px solid transparent'
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{badge}</span>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User card & Toggle */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{online ? '🟢 Online' : '🔴 Offline'}</div>
              <button 
                onClick={toggleDark}
                style={{ 
                  background: darkMode ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)', 
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : 'var(--border)'}`, 
                  color: darkMode ? '#fff' : 'var(--text-2)',
                  borderRadius: 20, 
                  padding: '5px 12px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  transition: 'all 0.2s',
                  boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                }}
              >
                {darkMode ? <Sun size={12} color="#fbbf24" strokeWidth={3} /> : <Moon size={12} color="var(--accent)" strokeWidth={3} />}
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.02em' }}>{darkMode ? 'LIGHT MODE' : 'DARK MODE'}</span>
              </button>
            </div>
            
            <div
              onClick={() => setPage('profile')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s', background: page === 'profile' ? 'var(--bg-elevated)' : 'transparent' }}
              onMouseEnter={e => { if (page !== 'profile') e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (page !== 'profile') e.currentTarget.style.background = 'transparent' }}
            >
              <div className="avatar avatar-sm" style={{ background: avatarColor(user?.name || ''), fontSize: 10, flexShrink: 0 }}>
                {user?.profilePhoto?.base64 || user?.photo ? <img src={user?.profilePhoto?.base64 || user?.photo || ''} alt="" /> : initials(user?.name || '')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize' }}>{user?.jobTitle || user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {(user?.role === 'admin') && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setPage('settings')}
                  style={{ flex: 1, background: 'transparent', borderColor: 'var(--border)' }}
                >
                  ⚙️ Settings
                </button>
              )}
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={logout}
                style={{ flex: 1, background: 'transparent', borderColor: 'var(--border)', color: 'var(--danger)' }}
              >
                Sign Out 🚪
              </button>
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
                {navItems.find(n => n.id === page)?.icon} {navItems.find(n => n.id === page)?.label || appName}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {/* Notifications */}
              <div style={{ position: 'relative' }} ref={notifRef}>
                <button className="btn btn-icon btn-secondary btn-sm" style={{ position: 'relative' }} onClick={() => setNotifOpen(v => !v)}>
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
                    ) : (notifications || []).slice(0, 30).map(n => {
                      const handleClick = () => {
                        if (!n.read) markRead(n.id)
                        let targetPage = n.linkedType === 'entry' ? 'approvals' :
                                         n.linkedType === 'leave' ? 'profile' :
                                         n.linkedType === 'message' ? 'messages' :
                                         n.linkedId ? 'dashboard' : null
                        if (targetPage) setPage(targetPage as any)
                        setNotifOpen(false)
                      }
                      return (
                        <div key={n.id} onClick={handleClick} style={{ display: 'flex', gap: 10, padding: '10px', background: n.read ? 'transparent' : 'var(--accent-subtle)', borderRadius: 6, marginBottom: 2, cursor: 'pointer', position: 'relative' }}>
                          <span style={{ fontSize: 16 }}>{n.type === 'badge' ? '🏆' : (n.type === 'approval' || n.type === 'entry_approved') ? '✅' : (n.type === 'rejection' || n.type === 'entry_rejected') ? '❌' : '🔔'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {n.title && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{n.title}</div>}
                            <div style={{ fontSize: 12, color: 'var(--text-1)', marginTop: n.title ? 2 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</div>
                          </div>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', position: 'absolute', top: 14, right: 10 }} />}
                        </div>
                      )
                    })}
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
      {user && settings?.featureToggles?.messaging && page !== 'messages' && <FloatingChatWidget />}
    </div>
  )
}

