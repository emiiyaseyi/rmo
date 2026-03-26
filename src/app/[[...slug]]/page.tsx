'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '@/context/AppContext'

import LoginPage from '@/components/auth/LoginPage'
import Tour from '@/components/auth/Tour'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/components/layout/Dashboard'
import TimesheetPage from '@/components/timesheet/TimesheetPage'
import ApprovalsPage from '@/components/approvals/ApprovalsPage'
import DelegationPage from '@/components/approvals/DelegationPage'
import LeaderboardPage from '@/components/leaderboard/LeaderboardPage'
import MessagesPage from '@/components/messages/MessagesPage'
import AnalyticsPage from '@/components/analytics/AnalyticsPage'
import StaffPage from '@/components/staff/StaffPage'
import SettingsPage from '@/components/settings/SettingsPage'
import ProfilePage from '@/components/profile/ProfilePage'
import LeaveRequestPage from '@/components/leave/LeaveRequestPage'
import HelpPage from '@/components/help/HelpPage'
import OrgChartPage from '@/components/orgchart/OrgChartPage'
import AuditPage from '@/components/audit/AuditPage'
import ProjectsPage from '@/components/admin/ProjectsPage'

const PAGE_ROLES: Record<string, string[]> = {
  dashboard: ['staff', 'team_lead', 'admin'],
  timesheet: ['staff', 'team_lead', 'admin'],
  approvals: ['staff', 'team_lead', 'admin'],
  delegation: ['team_lead', 'admin'],
  leaderboard: ['staff', 'team_lead', 'admin'],
  messages: ['staff', 'team_lead', 'admin'],
  projects: ['admin'],
  analytics: ['team_lead', 'admin'],
  staff: ['admin'],
  org_chart: ['admin'],
  audit: ['admin'],
  settings: ['admin'],
  profile: ['staff', 'team_lead', 'admin'],
  leave: ['staff', 'team_lead', 'admin'],
  help: ['staff', 'team_lead', 'admin'],
}

export default function Home() {
  const { user, staff, saveStaff, features, checkReminders, settings, canApproveTimesheets } = useApp()
  const [page, setPage] = useState('dashboard')
  const [showTour, setShowTour] = useState(false)
  const [isHydrating, setIsHydrating] = useState(true)
  const didInitUserState = useRef(false)

  // Handle URL segments for SPA routing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Remove the "?" if it exists (happens during some tunnel form submissions)
      if (window.location.search === '?') {
        window.history.replaceState({}, '', window.location.pathname)
      }

      const path = window.location.pathname.replace(/^\//, '')
      if (path && PAGE_ROLES[path]) {
        setPage(path)
      } else if (path && path !== '') {
        // Fallback to dashboard if path exists but invalid
        window.history.replaceState({}, '', '/')
        setPage('dashboard')
      }
    }

    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\//, '')
      if (path && PAGE_ROLES[path]) setPage(path)
      else setPage('dashboard')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(target: string) {
    if (target === 'leaderboard' && features && !features.leaderboard) return
    if (target === 'messages' && features && !features.messages) return
    if (target === 'analytics' && features && !features.analytics) return
    if (target === 'org_chart' && features && !features.org_chart) return
    if (target === 'delegation' && features && !features.delegation) return
    if (target === 'approvals' && !canApproveTimesheets()) return
    
    setPage(target)
    if (typeof window !== 'undefined') {
      const newPath = target === 'dashboard' ? '/' : `/${target}`
      if (window.location.pathname !== newPath) {
        window.history.pushState({}, '', newPath)
      }
    }
  }

  // Handle PIN change flag from login
  useEffect(() => {
    const pinChange = sessionStorage.getItem('dsn_pin_change')
    if (pinChange && user) {
      try {
        const updated = JSON.parse(pinChange)
        saveStaff(staff.map(s => s.id === updated.id ? { ...s, password: updated.password || updated.pin, first_login: false } : s))
        sessionStorage.removeItem('dsn_pin_change')
      } catch { }
    }
  }, [user, staff, saveStaff])

  // First-login tour
  useEffect(() => {
    const showWalkthrough = settings?.featureToggles?.firstLoginWalkthrough ?? true
    if (user && !user.tour_done && showWalkthrough) {
      const t = setTimeout(() => setShowTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [user, settings])

  // Submission reminders check on login
  useEffect(() => {
    if (user) {
      setTimeout(checkReminders, 2000)
    }
  }, [user?.id, checkReminders])

  // Guard page by role
  useEffect(() => {
    if (user && page !== 'dashboard') {
      if (page === 'approvals' && !canApproveTimesheets()) {
        setPage('dashboard')
        return
      }
      const allowed = PAGE_ROLES[page] || []
      if (!allowed.includes(user.role)) setPage('dashboard')
    }
  }, [page, user, canApproveTimesheets])

  // Reset URL on logout
  useEffect(() => {
    // Skip first run so session hydration doesn't rewrite current route to "/"
    if (!didInitUserState.current) {
      didInitUserState.current = true
      setIsHydrating(false)
      return
    }
    setIsHydrating(false)
    if (!user && typeof window !== 'undefined') {
      if (window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/')
      }
      setPage('dashboard')
    }
  }, [user])

  // Show blank screen during hydration to prevent login flash
  if (isHydrating) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-page)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            border: '4px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!user) return <LoginPage />

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard setPage={navigate} />
      case 'timesheet': return <TimesheetPage />
      case 'approvals': return <ApprovalsPage />
      case 'leave': return <LeaveRequestPage />
      case 'delegation': return <DelegationPage />
      case 'leaderboard': return <LeaderboardPage />
      case 'messages': return <MessagesPage />
      case 'projects': return <ProjectsPage />
      case 'analytics': return <AnalyticsPage />
      case 'staff': return <StaffPage />
      case 'org_chart': return <OrgChartPage />
      case 'audit': return <AuditPage />
      case 'settings': return <SettingsPage />
      case 'profile': return <ProfilePage setPage={navigate} />
      case 'help': return <HelpPage />
      default: return <Dashboard setPage={navigate} />
    }
  }


  return (
    <>
      <Layout page={page} setPage={navigate}>{renderPage()}</Layout>
      {showTour && <Tour onComplete={() => setShowTour(false)} />}
    </>
  )
}
