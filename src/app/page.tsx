'use client'

import React, { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { local } from '@/lib/utils'

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
import HelpPage from '@/components/help/HelpPage'
import OrgChartPage from '@/components/orgchart/OrgChartPage'
import AuditPage from '@/components/audit/AuditPage'
import BackendPage from '@/components/settings/BackendPage'
import ResetRequestsPage from '@/components/admin/ResetRequestsPage'

const PAGE_ROLES: Record<string, string[]> = {
  dashboard: ['staff', 'team_lead', 'admin', 'super_admin'],
  timesheet: ['staff', 'team_lead', 'admin', 'super_admin'],
  approvals: ['team_lead', 'admin', 'super_admin'],
  delegation: ['team_lead', 'admin', 'super_admin'],
  leaderboard: ['staff', 'team_lead', 'admin', 'super_admin'],
  messages: ['staff', 'team_lead', 'admin', 'super_admin'],
  analytics: ['team_lead', 'admin', 'super_admin'],
  staff: ['admin', 'super_admin'],
  org_chart: ['admin', 'super_admin'],
  audit: ['admin', 'super_admin'],
  reset_queue: ['admin', 'super_admin'],
  settings: ['admin', 'super_admin'],

  backend: ['admin', 'super_admin'],
  profile: ['staff', 'team_lead', 'admin', 'super_admin'],
  leave: ['staff', 'team_lead', 'admin', 'super_admin'],
  help: ['staff', 'team_lead', 'admin', 'super_admin'],
}

export default function Home() {
  const { user, staff, saveStaff, features, checkReminders } = useApp()
  const [page, setPage] = useState('dashboard')
  const [showTour, setShowTour] = useState(false)

  // Handle PIN change flag from login
  useEffect(() => {
    const pinChange = sessionStorage.getItem('dsn_pin_change')
    if (pinChange && user) {
      try {
        const updated = JSON.parse(pinChange)
        saveStaff(staff.map(s => s.id === updated.id ? { ...s, pin: updated.pin, first_login: false } : s))
        sessionStorage.removeItem('dsn_pin_change')
      } catch { }
    }
  }, [user, staff, saveStaff])

  // First-login tour
  useEffect(() => {
    if (user && !local.get('tour_completed', false)) {
      const t = setTimeout(() => setShowTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [user])

  // Submission reminders check on login
  useEffect(() => {
    if (user) {
      setTimeout(checkReminders, 2000)
    }
  }, [user?.id, checkReminders])

  // Guard page by role
  useEffect(() => {
    if (user && page !== 'dashboard') {
      const allowed = PAGE_ROLES[page] || []
      if (!allowed.includes(user.role)) setPage('dashboard')
    }
  }, [page, user])

  if (!user) return <LoginPage />

  function navigate(target: string) {
    if (target === 'leaderboard' && features && !features.leaderboard) return
    if (target === 'messages' && features && !features.messages) return
    if (target === 'analytics' && features && !features.analytics) return
    if (target === 'org_chart' && features && !features.org_chart) return
    if (target === 'delegation' && features && !features.delegation) return
    setPage(target)
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard setPage={navigate} />
      case 'timesheet': return <TimesheetPage />
      case 'approvals': return <ApprovalsPage />
      case 'leave': return <ProfilePage initialTab="leave" />
      case 'delegation': return <DelegationPage />
      case 'leaderboard': return <LeaderboardPage />
      case 'messages': return <MessagesPage />
      case 'analytics': return <AnalyticsPage />
      case 'staff': return <StaffPage />
      case 'org_chart': return <OrgChartPage />
      case 'audit': return <AuditPage />
      case 'reset_queue': return <ResetRequestsPage />
      case 'backend': return <BackendPage />

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
