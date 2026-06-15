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
  isHeader?: boolean;
}

function getNavItems(role: string): NavItem[] {
  const all: NavItem[] = [
    { id: 'work_header', label: 'MY WORK', icon: '', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', roles: ['staff', 'admin', 'team_lead'] },
    { id: 'timesheet', label: 'Timesheet', icon: '📋', roles: ['staff', 'admin', 'team_lead'] },
    { id: 'approvals', label: 'Approvals', icon: '✅', roles: ['admin', 'team_lead', 'staff'], badge: 'approvals' },
    { id: 'leave', label: 'Leave & Absence', icon: '🌴', roles: ['staff', 'team_lead', 'admin'] },

    { id: 'team_header', label: 'TEAM', icon: '', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'projects', label: 'Projects', icon: '💼', roles: ['admin'] },
    { id: 'analytics', label: 'Analytics', icon: '📊', roles: ['admin', 'team_lead'] },
    { id: 'delegation', label: 'Delegation', icon: '🤝', roles: ['admin', 'team_lead'] },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', roles: ['staff', 'admin', 'team_lead'] },
    { id: 'staff', label: 'Staff Management', icon: '👥', roles: ['admin'] },
    { id: 'org_chart', label: 'Organogram', icon: '🗂️', roles: ['admin'] },
    { id: 'audit', label: 'Audit Trail', icon: '📝', roles: ['admin'] },


    { id: 'connect_header', label: 'CONNECT', icon: '', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'help', label: 'Help & FAQ', icon: '❓', roles: ['staff', 'team_lead', 'admin'] },
  ]
  return all.filter(n => n.roles.includes(role))
}

interface LayoutProps {
  page: string;
  setPage: (page: string) => void;
  children: React.ReactNode;
}

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { user, logout, unreadCount, notifications, markAllRead, markRead, online, darkMode, toggleDark, pendingApprovals, canApproveTimesheets, settings, showPasswordChange, announcements } = useApp()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(local.get('sidebar_collapsed', false))
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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

  const canApprove = canApproveTimesheets()

  // Comprehensive search index for semantic platform search
  const searchableItems = React.useMemo(() => {
    const items = [
      // Navigation items
      ...getNavItems(user?.role || 'staff').map(item => ({
        id: item.id,
        label: item.label,
        keywords: [item.label.toLowerCase()],
        type: 'page' as const
      })),
      // Settings & Admin features
      { id: 'settings', label: 'Branding Settings', keywords: ['branding', 'logo', 'colors', 'theme', 'appearance', 'brand'], type: 'page' as const },
      { id: 'settings', label: 'Feature Toggles', keywords: ['features', 'toggle', 'enable', 'disable', 'modules'], type: 'page' as const },
      { id: 'settings', label: 'Points Configuration', keywords: ['points', 'gamification', 'awards', 'scoring'], type: 'page' as const },
      { id: 'settings', label: 'Hour Caps', keywords: ['caps', 'hours', 'weekly cap', 'limits'], type: 'page' as const },
      { id: 'settings', label: 'Week Locking', keywords: ['lock', 'week', 'freeze', 'prevent submissions'], type: 'page' as const },
      { id: 'settings', label: 'Public Holidays', keywords: ['holidays', 'public holiday', 'days off'], type: 'page' as const },
      { id: 'settings', label: 'Security Settings', keywords: ['security', 'password', 'authentication', '2fa', 'two factor'], type: 'page' as const },
      { id: 'settings', label: 'Activity Log', keywords: ['activity', 'log', 'audit', 'history', 'events'], type: 'page' as const },
      // Staff management features
      { id: 'staff', label: 'Staff Management', keywords: ['staff', 'approvals'], type: 'page' as const },
      { id: 'staff', label: 'Staff Accounts', keywords: ['staff', 'accounts', 'users', 'employees', 'team members'], type: 'page' as const },
      { id: 'staff', label: 'Password Resets', keywords: ['password', 'reset', 'unlock', 'account recovery'], type: 'page' as const },
      // Profile features
      { id: 'profile', label: 'Profile Settings', keywords: ['profile', 'account', 'personal', 'settings'], type: 'page' as const },
      { id: 'profile', label: 'Change Password', keywords: ['password', 'security', 'change password'], type: 'page' as const },
      { id: 'profile', label: 'Badges', keywords: ['badges', 'achievements', 'awards'], type: 'page' as const },
      { id: 'profile', label: 'Templates', keywords: ['templates', 'prefill', 'saved entries'], type: 'page' as const },
      // Analytics features
      { id: 'analytics', label: 'Time Report', keywords: ['time', 'report', 'detailed', 'hours', 'entries'], type: 'page' as const },
      { id: 'analytics', label: 'Department Report', keywords: ['department', 'report', 'dept', 'team stats'], type: 'page' as const },
      { id: 'analytics', label: 'Projects Report', keywords: ['projects', 'report', 'project hours'], type: 'page' as const },
      { id: 'analytics', label: 'Utilisation Report', keywords: ['utilisation', 'utilization', 'efficiency', 'productivity'], type: 'page' as const },
      // Other features
      { id: 'delegation', label: 'Approval Delegation', keywords: ['delegation', 'delegate', 'approval delegation', 'substitute'], type: 'page' as const },
    ]
    return items.filter(item => !item.label.includes('undefined'))
  }, [user?.role])

  const navItems = getNavItems(user?.role || 'staff').filter(item => {
    if (item.id === 'approvals' && !canApprove) return false

    // Feature toggle check
    const toggleKey = item.id === 'leaderboard' ? 'leaderboard' :
                     item.id === 'org_chart' ? 'org_chart' :
                     item.id === 'analytics' ? 'analytics' : null
    if (toggleKey && settings?.featureToggles) {
      if ((settings.featureToggles as any)[toggleKey] === false) return false
    }

    // Semantic search filter
    if (searchQuery.trim() && !item.isHeader) {
      const query = searchQuery.toLowerCase()
      // Check if query matches any searchable item
      const hasMatch = searchableItems.some(searchItem =>
        searchItem.keywords.some(keyword => keyword.includes(query)) ||
        searchItem.label.toLowerCase().includes(query)
      )
      // If search matches a feature but not this menu item, hide it
      const menuItemMatches = item.label.toLowerCase().includes(query) ||
        searchableItems.some(si => si.id === item.id && si.keywords.some(k => k.includes(query)))

      return menuItemMatches
    }

    return true
  })

  const pendingCount = pendingApprovals().length

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
          width: collapsed && !isMobile ? 80 : SIDEBAR_W,
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0, zIndex: 100,
          transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
          ...(isMobile ? {
            position: 'fixed', top: 0, bottom: 0, left: 0,
            transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          } : {
            position: 'relative',
            transform: 'none',
          })
        }}>
          <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            {(!collapsed || isMobile) ? (
              <img src={logoUrl || "/dsn.png"} alt="Logo" style={{ height: 48, objectFit: 'contain' }} />
            ) : (
              <div style={{ height: 48, width: 48, background: 'var(--accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 20 }}>D</div>
            )}
            
            {!isMobile && (
              <button 
                onClick={() => { const next = !collapsed; setCollapsed(next); local.set('sidebar_collapsed', next) }}
                style={{ position: 'absolute', right: -12, top: 34, width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
              >
                <div style={{ transform: collapsed ? 'rotate(180deg)' : 'none', fontSize: 10 }}>◀</div>
              </button>
            )}
          </div>

          {/* Search Bar */}
          {(!collapsed || isMobile) && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search platform..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 32px 8px 12px',
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-1)',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-3)',
                      fontSize: 14,
                      padding: 4
                    }}
                  >
                    ×
                  </button>
                )}
                {!searchQuery && (
                  <span style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-4)',
                    fontSize: 12,
                    pointerEvents: 'none'
                  }}>
                    🔍
                  </span>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchQuery.trim() && (
                <div style={{
                  marginTop: 8,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  maxHeight: 300,
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {(() => {
                    const query = searchQuery.toLowerCase()
                    const matches = searchableItems.filter(item =>
                      item.keywords.some(k => k.includes(query)) ||
                      item.label.toLowerCase().includes(query)
                    ).slice(0, 8)

                    if (matches.length === 0) {
                      return (
                        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                          No results found
                        </div>
                      )
                    }

                    return matches.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => {
                          setPage(item.id)
                          setSearchQuery('')
                          if (isMobile) setSidebarOpen(false)
                        }}
                        style={{
                          padding: '10px 16px',
                          fontSize: 12,
                          cursor: 'pointer',
                          borderBottom: idx < matches.length - 1 ? '1px solid var(--border)' : 'none',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                          {item.keywords.slice(0, 3).join(' · ')}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          )}

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
                    marginTop: idx === 0 ? 0 : 4,
                    textAlign: collapsed && !isMobile ? 'center' : 'left'
                  }}>
                    {collapsed && !isMobile ? '—' : item.label}
                  </div>
                )
              }
              
              const badge = item.badge === 'approvals' ? pendingCount : 0
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
                  {(!collapsed || isMobile) && <span style={{ flex: 1 }}>{item.label}</span>}
                  {badge > 0 && (
                    <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{badge}</span>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User card & Toggle */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: (collapsed && !isMobile) ? 'center' : 'space-between', padding: '0 8px' }}>
              {(!collapsed || isMobile) && <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{online ? '🟢 Online' : '🔴 Offline'}</div>}
              <button 
                onClick={toggleDark}
                style={{ 
                  background: darkMode ? 'rgba(255,255,255,0.1)' : 'var(--bg-elevated)', 
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : 'var(--border)'}`, 
                  color: darkMode ? '#fff' : 'var(--text-2)',
                  borderRadius: 20, 
                  padding: (collapsed && !isMobile) ? '5px' : '5px 12px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  transition: 'all 0.2s',
                  boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                }}
              >
                {darkMode ? <Sun size={12} color="#fbbf24" strokeWidth={3} /> : <Moon size={12} color="var(--accent)" strokeWidth={3} />}
                {(!collapsed || isMobile) && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.02em' }}>{darkMode ? 'LIGHT' : 'DARK'}</span>}
              </button>
            </div>
            
            <div
              onClick={() => setPage('profile')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s', background: page === 'profile' ? 'var(--bg-elevated)' : 'transparent' }}
              onMouseEnter={e => { if (page !== 'profile') e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (page !== 'profile') e.currentTarget.style.background = 'transparent' }}
            >
              <div className="avatar avatar-sm" title={user?.name} style={{ background: avatarColor(user?.name || ''), fontSize: 10, flexShrink: 0 }}>
                {initials(user?.name || '')}
              </div>
              {(!collapsed || isMobile) && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize' }}>{user?.jobTitle || user?.role?.replace('_', ' ')}</div>
                </div>
              )}
            </div>
            
            <div style={{ display: (collapsed && !isMobile) ? 'none' : 'flex', gap: 4, marginTop: 4 }}>
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
                    ) : (notifications || []).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 30).map(n => {
                      const handleClick = () => {
                        if (!n.read) markRead(n.id)
                        let targetPage = n.linkedType === 'entry' ? 'approvals' :
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
    </div>
  )
}
