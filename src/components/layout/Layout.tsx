'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { initials, avatarColor, local, getSubmissionWindowStatus } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  Bell, Menu, Sun, Moon, Search, X, LogOut, Settings,
  Home, CalendarDays, CheckSquare, Zap, Briefcase, BarChart3,
  Trophy, Users, Network, ScrollText, HelpCircle,
} from 'lucide-react'
import PasswordChangeModal from '../auth/PasswordChangeModal'
import IdleWarningOverlay from '../auth/IdleWarningOverlay'

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>

interface NavItem {
  id: string;
  label: string;
  Icon?: IconType;
  roles: string[];
  badge?: string;
  isHeader?: boolean;
}

function getNavItems(role: string): NavItem[] {
  const all: NavItem[] = [
    { id: 'work_header', label: 'MY WORK', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'dashboard', label: 'Dashboard', Icon: Home, roles: ['staff', 'admin', 'team_lead'] },
    { id: 'timesheet', label: 'Timesheet', Icon: CalendarDays, roles: ['staff', 'admin', 'team_lead'] },
    { id: 'approvals', label: 'Approvals', Icon: CheckSquare, roles: ['admin', 'team_lead', 'staff'], badge: 'approvals' },
    { id: 'leave', label: 'Leave & Absence', Icon: Zap, roles: ['staff', 'team_lead', 'admin'] },

    { id: 'team_header', label: 'TEAM', roles: ['staff', 'team_lead', 'admin'], isHeader: true },
    { id: 'projects', label: 'Projects', Icon: Briefcase, roles: ['admin'] },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3, roles: ['admin', 'team_lead'] },
    { id: 'leaderboard', label: 'Leaderboard', Icon: Trophy, roles: ['staff', 'admin', 'team_lead'] },
    { id: 'staff', label: 'Staff Management', Icon: Users, roles: ['admin'] },
    { id: 'org_chart', label: 'Organogram', Icon: Network, roles: ['admin'] },

    { id: 'system_header', label: 'SYSTEM', roles: ['admin', 'staff', 'team_lead'], isHeader: true },
    { id: 'audit', label: 'Audit Trail', Icon: ScrollText, roles: ['admin'] },
    { id: 'help', label: 'Help & FAQ', Icon: HelpCircle, roles: ['staff', 'team_lead', 'admin'] },
  ]
  return all.filter(n => n.roles.includes(role))
}

const PAGE_SUB: Record<string, string> = {
  dashboard: 'Your week at a glance',
  timesheet: 'Log and manage your hours',
  approvals: 'Review submitted timesheets',
  leave: 'Log leave and absences',
  projects: 'Projects and budgets',
  analytics: 'Reports and insights',
  leaderboard: 'Rankings, badges & rewards',
  staff: 'Manage staff accounts',
  org_chart: 'Organisation structure',
  audit: 'System activity log',
  help: 'Guides and FAQ',
  settings: 'Platform configuration',
  profile: 'Your account',
}
// (delegation removed)

interface LayoutProps {
  page: string;
  setPage: (page: string) => void;
  children: React.ReactNode;
}

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { user, logout, unreadCount, notifications, markAllRead, markRead, online, darkMode, toggleDark, pendingApprovals, canApproveTimesheets, settings, showPasswordChange, announcements } = useApp()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (isMobile) setSidebarOpen(false) }, [page, isMobile])
  useEffect(() => { if (!isMobile) setSidebarOpen(false) }, [isMobile])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const canApprove = canApproveTimesheets()

  const searchableItems = React.useMemo(() => {
    const items = [
      ...getNavItems(user?.role || 'staff').filter(i => !i.isHeader).map(item => ({
        id: item.id, label: item.label, keywords: [item.label.toLowerCase()], type: 'page' as const
      })),
      { id: 'settings', label: 'Branding Settings', keywords: ['branding', 'logo', 'colors', 'theme', 'appearance', 'brand'], type: 'page' as const },
      { id: 'settings', label: 'Feature Toggles', keywords: ['features', 'toggle', 'enable', 'disable', 'modules'], type: 'page' as const },
      { id: 'settings', label: 'Points Configuration', keywords: ['points', 'gamification', 'awards', 'scoring'], type: 'page' as const },
      { id: 'settings', label: 'Hour Caps', keywords: ['caps', 'hours', 'weekly cap', 'limits'], type: 'page' as const },
      { id: 'settings', label: 'Week Locking', keywords: ['lock', 'week', 'freeze', 'prevent submissions'], type: 'page' as const },
      { id: 'settings', label: 'Public Holidays', keywords: ['holidays', 'public holiday', 'days off'], type: 'page' as const },
      { id: 'settings', label: 'Security Settings', keywords: ['security', 'password', 'authentication', '2fa', 'two factor'], type: 'page' as const },
      { id: 'settings', label: 'Activity Log', keywords: ['activity', 'log', 'audit', 'history', 'events'], type: 'page' as const },
      { id: 'staff', label: 'Staff Accounts', keywords: ['staff', 'accounts', 'users', 'employees', 'team members'], type: 'page' as const },
      { id: 'staff', label: 'Password Resets', keywords: ['password', 'reset', 'unlock', 'account recovery'], type: 'page' as const },
      { id: 'profile', label: 'Profile Settings', keywords: ['profile', 'account', 'personal', 'settings'], type: 'page' as const },
      { id: 'profile', label: 'Change Password', keywords: ['password', 'security', 'change password'], type: 'page' as const },
      { id: 'profile', label: 'Badges', keywords: ['badges', 'achievements', 'awards'], type: 'page' as const },
      { id: 'profile', label: 'Templates', keywords: ['templates', 'prefill', 'saved entries'], type: 'page' as const },
      { id: 'analytics', label: 'Time Report', keywords: ['time', 'report', 'detailed', 'hours', 'entries'], type: 'page' as const },
      { id: 'analytics', label: 'Department Report', keywords: ['department', 'report', 'dept', 'team stats'], type: 'page' as const },
      { id: 'analytics', label: 'Projects Report', keywords: ['projects', 'report', 'project hours'], type: 'page' as const },
      { id: 'analytics', label: 'Utilisation Report', keywords: ['utilisation', 'utilization', 'efficiency', 'productivity'], type: 'page' as const },
    ]
    return items.filter(item => !item.label.includes('undefined'))
  }, [user?.role])

  const navItems = getNavItems(user?.role || 'staff').filter(item => {
    if (item.id === 'approvals' && !canApprove) return false
    const toggleKey = item.id === 'leaderboard' ? 'leaderboard' :
                     item.id === 'org_chart' ? 'org_chart' :
                     item.id === 'analytics' ? 'analytics' : null
    if (toggleKey && settings?.featureToggles) {
      if ((settings.featureToggles as any)[toggleKey] === false) return false
    }
    return true
  })

  const pendingCount = pendingApprovals().length

  const branding = settings?.branding
  const appName = branding?.appName || 'DSN RMO'

  const activeAnnouncements = (announcements || []).filter(a =>
    a.active && (!a.expiresAt || new Date(a.expiresAt).getTime() > Date.now())
  )

  useEffect(() => {
    if (branding?.primaryColour) document.documentElement.style.setProperty('--primary', branding.primaryColour)
    if (branding?.secondaryColour) document.documentElement.style.setProperty('--secondary', branding.secondaryColour)
  }, [branding])

  // Submission window status pill
  const winStatus = React.useMemo(() => {
    try { return getSubmissionWindowStatus((settings as any)?.submissionWindow) } catch { return null }
  }, [settings])
  const windowPill = (() => {
    if (!winStatus) return null
    if (winStatus.isOpen && winStatus.deadline) {
      const ms = winStatus.deadline.getTime() - Date.now()
      if (ms > 0) {
        const d = Math.floor(ms / 86400000)
        const h = Math.floor((ms % 86400000) / 3600000)
        return { open: true, text: `Window open · ${d > 0 ? `${d}d ` : ''}${h}h` }
      }
    }
    if (winStatus.isPastDeadline) return { open: false, text: 'Window closed' }
    if (winStatus.isClosed) return { open: false, text: 'Window not open' }
    return { open: true, text: 'Window open' }
  })()

  const pageTitle = navItems.find(n => n.id === page)?.label
    || (page === 'settings' ? 'Settings' : page === 'profile' ? 'Profile' : appName)
  const pageSub = PAGE_SUB[page] || ''

  const matches = searchQuery.trim()
    ? searchableItems.filter(item => {
        const q = searchQuery.toLowerCase()
        return item.keywords.some(k => k.includes(q)) || item.label.toLowerCase().includes(q)
      }).slice(0, 8)
    : []

  const SIDEBAR_W = 264

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>

      {/* Announcements */}
      {activeAnnouncements.map(ann => (
        <div key={ann.id} style={{
          background: ann.priority === 'high' ? 'var(--danger)' : 'var(--brand)',
          color: 'white', padding: '8px 20px', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexShrink: 0, zIndex: 200,
        }}>
          <span>📢</span><span>{ann.message}</span>
        </div>
      ))}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }} />
        )}

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: SIDEBAR_W, flexShrink: 0, background: 'var(--surface)',
          borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', zIndex: 100,
          ...(isMobile ? {
            position: 'fixed', top: 0, bottom: 0, left: 0,
            transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          } : { position: 'relative' })
        }}>
          {/* Brand */}
          <div style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--line-2)' }}>
            <img src={branding?.logoBase64 || '/dsn.png'} alt={appName} style={{ height: 38, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          </div>

          {/* Search */}
          <div style={{ padding: '14px 14px 8px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', display: 'flex' }}><Search size={15} /></span>
              <input
                placeholder="Search platform…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 30px 8px 34px', fontSize: 12.5, fontFamily: 'inherit', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--elev)', color: 'var(--ink)', outline: 'none' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', display: 'flex', padding: 2 }}><X size={14} /></button>
              )}
            </div>
            {searchQuery.trim() && (
              <div style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', maxHeight: 300, overflowY: 'auto', boxShadow: 'var(--sh-md)' }}>
                {matches.length === 0 ? (
                  <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>No results found</div>
                ) : matches.map((item, idx) => (
                  <div key={`${item.id}-${idx}`}
                    onClick={() => { setPage(item.id); setSearchQuery(''); if (isMobile) setSidebarOpen(false) }}
                    style={{ padding: '10px 14px', fontSize: 12, cursor: 'pointer', borderBottom: idx < matches.length - 1 ? '1px solid var(--line-2)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--elev)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{item.keywords.slice(0, 3).join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 12px' }}>
            {navItems.map((item, idx) => {
              if (item.isHeader) {
                const sectionItems = []
                for (const next of navItems.slice(idx + 1)) { if (next.isHeader) break; sectionItems.push(next) }
                if (sectionItems.length === 0) return null
                return (
                  <div key={item.id} style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.09em', padding: idx === 0 ? '12px 10px 6px' : '16px 10px 6px' }}>{item.label}</div>
                )
              }
              const badge = item.badge === 'approvals' ? pendingCount : 0
              const active = page === item.id
              const Icon = item.Icon!
              return (
                <div key={item.id} onClick={() => setPage(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 'var(--r-sm)',
                    cursor: 'pointer', marginBottom: 2, fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--brand)' : 'var(--ink-2)',
                    background: active ? 'var(--tint)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--elev)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ display: 'flex', color: active ? 'var(--brand)' : 'var(--ink-3)' }}><Icon size={18} strokeWidth={2} /></span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{ background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, fontFamily: 'var(--mono)' }}>{badge}</span>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Profile footer */}
          <div style={{ padding: 12, borderTop: '1px solid var(--line-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--elev)' }}>
              <div onClick={() => setPage('profile')} title={user?.name} style={{ width: 34, height: 34, borderRadius: 9, background: avatarColor(user?.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12.5, flexShrink: 0, cursor: 'pointer' }}>
                {initials(user?.name || '')}
              </div>
              <div onClick={() => setPage('profile')} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{user?.jobTitle || user?.role?.replace('_', ' ')}</div>
              </div>
              {user?.role === 'admin' && (
                <span onClick={() => setPage('settings')} title="Settings" style={{ display: 'flex', color: 'var(--ink-4)', cursor: 'pointer', padding: 5, borderRadius: 7 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-2)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-4)'}><Settings size={16} /></span>
              )}
              <span onClick={logout} title="Sign out" style={{ display: 'flex', color: 'var(--ink-4)', cursor: 'pointer', padding: 5, borderRadius: 7 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-4)'}><LogOut size={16} /></span>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Topbar */}
          <header style={{ height: 64, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 26px', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {isMobile && (
                <button onClick={() => setSidebarOpen(true)} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', cursor: 'pointer' }}><Menu size={18} /></button>
              )}
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.01em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageTitle}</h2>
                {pageSub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{pageSub}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {windowPill && !isMobile && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: windowPill.open ? 'var(--tint)' : 'var(--danger-tint)', color: windowPill.open ? 'var(--brand-2)' : 'var(--danger)', padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: windowPill.open ? 'var(--brand)' : 'var(--danger)' }} />{windowPill.text}
                </div>
              )}
              <button onClick={toggleDark} title="Toggle theme" style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--elev)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              {/* Notifications */}
              <div style={{ position: 'relative' }} ref={notifRef}>
                <button onClick={() => setNotifOpen(v => !v)} style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--elev)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: 7, right: 8, minWidth: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--surface)' }} />
                  )}
                </button>
                {notifOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 46, minWidth: 320, maxHeight: 400, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', boxShadow: 'var(--sh-md)', padding: 6, zIndex: 300 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--line-2)', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>Notifications</span>
                      {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>No notifications</div>
                    ) : (notifications || []).slice().sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 30).map(n => {
                      const handleClick = () => {
                        if (!n.read) markRead(n.id)
                        const targetPage = n.linkedType === 'entry' ? 'approvals' : n.linkedId ? 'dashboard' : null
                        if (targetPage) setPage(targetPage)
                        setNotifOpen(false)
                      }
                      return (
                        <div key={n.id} onClick={handleClick} style={{ display: 'flex', gap: 10, padding: 10, background: n.read ? 'transparent' : 'var(--tint)', borderRadius: 8, marginBottom: 2, cursor: 'pointer', position: 'relative' }}>
                          <span style={{ fontSize: 16 }}>{n.type === 'badge' ? '🏆' : (n.type === 'approval' || n.type === 'entry_approved') ? '✅' : (n.type === 'rejection' || n.type === 'entry_rejected') ? '❌' : '🔔'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {n.title && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{n.title}</div>}
                            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: n.title ? 2 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</div>
                          </div>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', position: 'absolute', top: 14, right: 10 }} />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div onClick={() => setPage('profile')} title={user?.name} style={{ width: 38, height: 38, borderRadius: 10, background: avatarColor(user?.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {initials(user?.name || '')}
              </div>
            </div>
          </header>

          <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 26, minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
      {user && showPasswordChange && <PasswordChangeModal />}
      <IdleWarningOverlay />
    </div>
  )
}
