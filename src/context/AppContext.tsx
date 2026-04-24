'use client'
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { local, genId, DEFAULT_POINTS, BADGES, getWeekKey, registerSession, removeSession, sendEmailNotification } from '../lib/utils'
import { format, subWeeks } from 'date-fns'
import { Staff, Entry, AppSettings, AppContextType, AppNotification, Redemption, Reward, HofEntry, OverrideLog, WeekSubmission, ApprovalDelegation, ProjectBudget, BulkImportLog, BulkStaffImportLog, StreakRecoveryRequest, PointsHistoryEntry, PasswordResetRequest, Announcement, WeekLock, AuditLog, PublicHoliday, Delegation } from '../types'

const AppCtx = createContext<AppContextType | null>(null)
export const useApp = () => useContext(AppCtx) as AppContextType

// ---------------------------------------------------------------------------
// Generic upsert helper — calls PUT /api/<endpoint> for each item
// ---------------------------------------------------------------------------
async function apiUpsert(endpoint: string, items: any | any[], { throwOnError = false } = {}): Promise<void> {
  const list: any[] = Array.isArray(items) ? items : [items]
  const results = await Promise.allSettled(
    list.map(item =>
      fetch(`/api/${endpoint}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`) })
    )
  )
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    console.error(`apiUpsert ${endpoint} failed (${failed.length}/${list.length}):`, (failed[0] as PromiseRejectedResult).reason)
    if (throwOnError) throw new Error(`Failed to save ${endpoint}`)
  }
}

async function apiPost(endpoint: string, body: any) {
  return fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(e => console.error(`apiPost ${endpoint} failed`, e))
}

async function apiDelete(endpoint: string, id: string) {
  return fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' })
    .catch(e => console.error(`apiDelete ${endpoint}/${id} failed`, e))
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [notifications, setNots] = useState<AppNotification[]>([])
  const [darkMode, setDarkMode] = useState<boolean>(false)
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [features, setFeatures] = useState<any>(DEFAULT_FEATURES)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [weekLocks, setWeekLocks] = useState<WeekLock[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([])
  const [projects, setProjects] = useState<any[]>(DEFAULT_PROJECTS)
  const [redeems, setRedeems] = useState<Redemption[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [hof, setHof] = useState<HofEntry[]>([])
  const [delegations, setDelegations] = useState<any[]>([])
  const [approvalDelegations, setApprovalDelegations] = useState<ApprovalDelegation[]>([])
  const [lockedWeeks, setLockedWeeks] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [projectBudgets, setProjectBudgets] = useState<ProjectBudget[]>([])
  const [bulkImportLogs, setBulkImportLogs] = useState<BulkImportLog[]>([])
  const [bulkStaffImportLogs, setBulkStaffImportLogs] = useState<BulkStaffImportLog[]>([])
  const [streakRecoveries, setStreakRecoveries] = useState<StreakRecoveryRequest[]>([])
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryEntry[]>([])
  const [idleCountdown, setIdleCountdown] = useState<number | null>(null)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [prefillTemplate, setPrefillTemplate] = useState<any>(null)
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([])

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const userRef = useRef<Staff | null>(null)
  const pollNowRef = useRef<(() => void) | null>(null)

  // ---------------------------------------------------------------------------
  // Initialisation (session restore, dark mode, idle listeners)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const migrated = sessionStorage.getItem('dsn_migrated_v3')
      if (!migrated) {
        localStorage.clear()
        sessionStorage.setItem('dsn_migrated_v3', 'true')
      }
    }

    const savedUser = local.get<Staff | null>('session_user', null)
    if (savedUser) { setUser(savedUser); userRef.current = savedUser }

    // Load settings from DB on first render
    fetch('/api/settings?key=global')
      .then(r => r.json())
      .then(s => {
        if (s && Object.keys(s).length) {
          setSettings({ ...DEFAULT_SETTINGS, ...s, featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...s.featureToggles } })
        }
      })
      .catch(() => {})

    const dm = local.get<boolean>('dark_mode', false)
    setDarkMode(dm)
    document.body.classList.toggle('dark', dm)

    const acts = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    const handler = () => { if (idleCountdown === null) resetIdle() }
    acts.forEach(e => window.addEventListener(e, handler, { passive: true }))
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))

    return () => {
      acts.forEach(e => window.removeEventListener(e, handler))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [idleCountdown])

  // ---------------------------------------------------------------------------
  // 30-second polling — replaces all 15 onSnapshot listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      try {
        const res = await fetch(`/api/poll?userId=${user.id}&role=${user.role}`)
        if (!res.ok) return
        const data = await res.json()

        setStaff(data.staff ?? [])
        setEntries(data.entries ?? [])
        if (data.notifications) {
          setNots(prev => {
            const readIds = new Set(prev.filter(n => n.read).map(n => n.id))
            return data.notifications.map((n: any) => readIds.has(n.id) ? { ...n, read: true } : n)
          })
        }
        setApprovalDelegations(data.approvalDelegations ?? [])
        setRewards(data.rewards ?? [])
        setRedeems(data.redeems ?? [])
        setAnnouncements(data.announcements ?? [])
        setPublicHolidays(data.publicHolidays ?? [])
        setAuditLogs((data.auditLogs ?? []).slice(0, 2000))
        setProjects(data.projects ?? [])
        if (data.templates) setTemplates(data.templates)

        if (data.settings && Object.keys(data.settings).length) {
          setSettings(s => ({
            ...DEFAULT_SETTINGS, ...data.settings,
            featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...data.settings.featureToggles }
          }))
        }

        // Review window check (admin-only, triggers email + penalty logic server-side)
        if (user.role === 'admin' && data.settings) {
          fetch('/api/review-window/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: data.settings }),
          }).catch(() => {})

          // Submission reminder: email staff 30 min before window closes
          fetch('/api/submission-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: data.settings }),
          }).catch(() => {})
        }

        // Force-logout check (replaces security onSnapshot listener)
        if (data.forceLogout) {
          await fetch(`/api/staff/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force_logout: false }),
          })
          logout()
          toast('Your session has been terminated by an administrator.', { icon: '🚫' })
        }
      } catch (err) {
        console.error('Poll failed:', err)
      }
    }

    pollNowRef.current = fetchAll
    fetchAll()
    const interval = setInterval(fetchAll, 30_000)
    return () => { clearInterval(interval); pollNowRef.current = null }
  }, [user?.id, user?.role])

  // ---------------------------------------------------------------------------
  // Session heartbeat (30s) + cleanup on logout
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    const pulse = () => fetch('/api/auth/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id, userName: user.name, email: user.email,
        role: user.role, department: user.department || '',
        lastSeen: new Date().toISOString(),
        loginAt: user.last_login || new Date().toISOString(),
      }),
    }).catch(e => console.error('Heartbeat failed', e))

    pulse()
    const heartbeat = setInterval(pulse, 30_000)
    return () => {
      clearInterval(heartbeat)
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {})
    }
  }, [user?.id])

  // ---------------------------------------------------------------------------
  // Audit log cleanup — runs once daily for admins
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user || user.role !== 'admin') return
    const cleanup = () => fetch('/api/audit-logs/cleanup', { method: 'DELETE' }).catch(() => {})
    cleanup()
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user?.id, user?.role])

  // ---------------------------------------------------------------------------
  // Idle timer
  // ---------------------------------------------------------------------------
  function resetIdle() {
    if ((idleTimerRef as any).currentCountdownInterval) {
      clearInterval((idleTimerRef as any).currentCountdownInterval)
      ;(idleTimerRef as any).currentCountdownInterval = null
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setIdleCountdown(null)
    const totalMins = settings?.idle_minutes || 5
    const warnAt = (totalMins * 60) - 30

    idleTimerRef.current = setTimeout(() => {
      let remaining = 30
      setIdleCountdown(remaining)
      const interval = setInterval(() => {
        remaining -= 1
        setIdleCountdown(remaining)
        if (remaining <= 0) {
          clearInterval(interval)
          if (userRef.current) logoutFn(userRef.current)
        }
      }, 1000)
      ;(idleTimerRef as any).currentCountdownInterval = interval
    }, warnAt * 1000)
  }

  function loadAll() { /* no-op: data loaded via polling */ }

  // ---------------------------------------------------------------------------
  // Save functions — optimistic local state update + async API persist
  // ---------------------------------------------------------------------------
  function saveStaff(data: Staff[]) {
    const prev = staff
    setStaff(data)
    data.forEach(s => {
      const old = prev.find(p => p.id === s.id)
      if (!old || JSON.stringify(old) !== JSON.stringify(s)) {
        apiUpsert('staff', s)
      }
    })
  }

  function saveEntries(data: Entry[]) {
    // Only upsert entries that actually changed — avoids firing 100s of PUTs on every keystroke
    const changed = data.filter(e => {
      const prev = entries.find(p => p.id === e.id)
      return !prev || JSON.stringify(prev) !== JSON.stringify(e)
    })
    setEntries(data)
    if (changed.length === 0) return
    apiUpsert('entries', changed).catch(() => {
      // Re-sync from DB immediately so the UI doesn't stay in a stale optimistic state
      pollNowRef.current?.()
    })
  }

  function saveNots(data: AppNotification[]) {
    setNots(data)
    data.forEach(n => {
      const prev = notifications.find(p => p.id === n.id)
      if (!prev || prev.read !== n.read) apiUpsert('notifications', n)
    })
  }

  function saveRedeems(data: Redemption[]) {
    setRedeems(data)
    data.forEach(r => apiUpsert('redeems', r))
  }

  function saveRewards(data: Reward[]) {
    setRewards(data)
    data.forEach(r => apiUpsert('rewards', r))
  }

  function saveHof(data: HofEntry[]) {
    setHof(data)
    apiPost('hof', data)
  }


  function saveSettings(data: AppSettings) {
    setSettings(data)
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'global', value: data }),
    }).catch(e => console.error('saveSettings failed', e))
  }

  function saveAnnouncements(data: Announcement[]) {
    setAnnouncements(data)
    data.forEach(a => apiUpsert('announcements', a))
  }

  function savePublicHolidays(data: PublicHoliday[]) {
    setPublicHolidays(data)
    data.forEach(h => apiUpsert('public-holidays', h))
  }

  function logAudit(action: string, targetId: string, metadata: any = {}) {
    const entry: AuditLog = {
      id: genId(),
      action: action as any,
      performedBy: user?.name || 'System',
      targetId,
      device: `${navigator.platform} (${navigator.language}) | ${navigator.userAgent.slice(0, 40)}`,
      ipAddress: 'Local Browser',
      timestamp: new Date().toISOString(),
      metadata
    }
    const updated = [entry, ...auditLogs].slice(0, 1000)
    saveAuditLogs(updated)
  }

  function saveAuditLogs(data: AuditLog[]) {
    setAuditLogs(data)
    // Only persist new entries (avoid re-sending the entire array on every call)
    const existing = new Set(auditLogs.map(l => l.id))
    data.filter(l => !existing.has(l.id)).forEach(l => apiPost('audit-logs', l))
  }

  function saveDelegations(data: Delegation[]) {
    setDelegations(data)
    data.forEach(d => apiUpsert('delegations', d))
  }

  function saveApprovalDelegations(data: ApprovalDelegation[]) {
    setApprovalDelegations(data)
    data.forEach(d => apiUpsert('approval-delegations', d))
  }

  function saveLockedWeeks(data: string[]) {
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'lockedWeeks', value: { lockedWeeks: data } }),
    }).catch(() => {})
  }

  function saveFeatures(data: any) {
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'features', value: data }),
    }).catch(() => {})
  }

  function saveWeekLocks(data: WeekLock[]) {
    setWeekLocks(data)
    apiPost('week-locks', data)
  }

  function saveProjects(data: any[]) {
    const newIds = new Set(data.map(p => p.id))
    projects.forEach(p => { if (!newIds.has(p.id)) apiDelete('projects', p.id) })
    setProjects(data)
    data.forEach(p => apiUpsert('projects', p))
  }

  function saveBudgets(data: any[]) {
    setBudgets(data)
    apiPost('budgets', data)
  }

  function saveTemplates(data: any[]) {
    setTemplates(data)
    apiPost('templates', data)
  }

  function saveProjectBudgets(data: ProjectBudget[]) {
    setProjectBudgets(data)
    apiPost('project-budgets', data)
  }

  function saveBulkImportLogs(data: BulkImportLog[]) {
    setBulkImportLogs(data)
    data.forEach(l => apiPost('bulk-import-logs', l))
  }

  function saveBulkStaffImportLogs(data: BulkStaffImportLog[]) {
    setBulkStaffImportLogs(data)
    data.forEach(l => apiPost('bulk-staff-import-logs', l))
  }

  function saveStreakRecoveries(data: StreakRecoveryRequest[]) {
    setStreakRecoveries(data)
    data.forEach(r => apiUpsert('streak-recoveries', r))
  }

  function savePointsHistory(data: PointsHistoryEntry[]) {
    setPointsHistory(data)
    apiPost('points-history', data)
  }

  function savePasswordResetRequests(data: PasswordResetRequest[]) {
    setPasswordResetRequests(data)
    data.forEach(r => {
      apiUpsert('password-reset-requests', r)
      if (r.status === 'pending') {
        const admins = staff.filter(s => s.role === 'admin')
        const requester = staff.find(s => s.id === r.staffId)
        admins.forEach(admin => {
          notify(admin.id, `Password reset requested by ${requester?.name || 'Staff'}`, 'password_reset_request', 'Reset Request', r.id, 'request')
        })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  async function login(staffMember: Staff) {
    if (!staffMember.email.endsWith('@datasciencenigeria.ai')) {
      throw new Error('Unauthorized domain. Please use your @datasciencenigeria.ai email.')
    }
    if (staffMember.status === 'suspended' || staffMember.suspended) {
      throw new Error('Your account has been suspended. Please contact administrator.')
    }
    if (staffMember.lockout_until && new Date(staffMember.lockout_until) > new Date()) {
      const remaining = Math.ceil((new Date(staffMember.lockout_until).getTime() - Date.now()) / 60000)
      throw new Error(`Account locked. Please try again in ${remaining} minutes.`)
    }

    const updated = { ...staffMember, last_login: new Date().toISOString(), force_logout: false }
    setUser(updated)
    userRef.current = updated
    local.set('session_user', updated)
    registerSession(staffMember.id)
    logAudit('login', staffMember.id, { name: staffMember.name })
    resetIdle()

    // Clear failed attempts
    fetch(`/api/staff/${staffMember.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ failed_attempts: 0, lockout_until: null, force_logout: false }),
    }).catch(() => {})

    if (staffMember.first_login || staffMember.password === 'dsn-staff' || staffMember.password === '1234') {
      setShowPasswordChange(true)
    }
  }

  function logoutFn(u?: Staff | null) {
    const target = u || userRef.current
    if (target) {
      logAudit('logout', target.id, { name: target.name })
      removeSession(target.id)
    }
    setUser(null)
    userRef.current = null
    local.remove('session_user')
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
  }

  function logout() { logoutFn(user) }

  function updateUser(updates: Partial<Staff>) {
    if (!user) return
    const updated = { ...user, ...updates }
    setUser(updated)
    userRef.current = updated
    local.set('session_user', updated)
    saveStaff(staff.map(s => s.id === user.id ? { ...s, ...updates } : s))
  }

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    local.set('dark_mode', next)
    document.body.classList.toggle('dark', next)
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  function notify(userId: string, message: string, type = 'info', title = 'New Notification', linkedId?: string, linkedType?: string, overrideEmail?: string, sendEmail = true) {
    const notif: AppNotification = {
      id: genId(),
      userId,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      title: title || 'New Notification',
      linkedId: linkedId || '',
      linkedType: linkedType || ''
    }
    const updated = [notif, ...notifications]
    saveNots(updated)

    const targetUser = staff.find(s => s.id === userId)
    const targetEmail = overrideEmail || targetUser?.email
    const EMAIL_TYPES = [
      'entry_approved', 'entry_rejected',
      'leave_approved', 'leave_declined',
      'password_reset', 'password_reset_request',
      'account_unlock',
    ]
    if (sendEmail && targetEmail && targetEmail.endsWith('@datasciencenigeria.ai') && EMAIL_TYPES.includes(type)) {
      let link = ''
      if (linkedType === 'entry') link = `/approvals`
      else if (linkedId) link = `/dashboard`
      sendEmailNotification(targetEmail, title || 'New Notification', message, link)
    }
    return notif
  }

  function markRead(notifId: string) {
    setNots(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
    fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notifId }),
    }).catch(() => {})
  }

  function markAllRead() {
    const updated = notifications.map(n => n.userId === user?.id ? { ...n, read: true } : n)
    saveNots(updated)
    fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id }),
    }).catch(() => {})
  }

  const myNotifications = notifications.filter(n => n.userId === user?.id)
  const unreadCount = myNotifications.filter(n => !n.read).length

  // ---------------------------------------------------------------------------
  // Gamification
  // ---------------------------------------------------------------------------
  function awardPoints(staffId: string, points: number, action: string, weekId: string = getWeekKey()) {
    const idx = staff.findIndex(s => s.id === staffId)
    if (idx === -1) return
    const updated = [...staff]
    const s = updated[idx]
    const newTotal = (s.points || 0) + points
    const newWeekPoints = (s.currentWeekPoints || 0) + (weekId === getWeekKey() ? points : 0)
    updated[idx] = { ...s, points: newTotal, currentWeekPoints: newWeekPoints, lastSubmittedWeek: weekId }

    const historyEntry: PointsHistoryEntry = {
      id: genId(),
      weekId,
      action,
      points,
      timestamp: new Date().toISOString()
    }
    saveStaff(updated)
    savePointsHistory([historyEntry, ...pointsHistory])
    if (staffId === user?.id) updateUser({ points: newTotal, currentWeekPoints: newWeekPoints })
    if (newTotal >= 100 && !s.badges?.includes('century_club')) grantBadge(staffId, 'century_club')
  }

  function grantBadge(staffId: string, badgeId: string) {
    const idx = staff.findIndex(s => s.id === staffId)
    if (idx === -1) return
    const badges = staff[idx].badges || []
    if (badges.includes(badgeId)) return
    const updated = [...staff]
    updated[idx] = { ...updated[idx], badges: [...badges, badgeId] }
    saveStaff(updated)
    const badge = BADGES.find(b => b.id === badgeId)
    notify(staffId, `🏆 You earned the "${badge?.name}" badge!`, 'badge')
  }

  // ---------------------------------------------------------------------------
  // Approval helpers
  // ---------------------------------------------------------------------------
  function pendingApprovals() {
    if (!user) return []
    const normalizedUserName = (user.name || '').trim().toLowerCase()
    const now = new Date()
    const activeDelegations = approvalDelegations.filter(d =>
      d.isActive && d.delegateId === user.id &&
      new Date(d.startDate) <= now && new Date(d.endDate) >= now
    )
    const delegatedTaskOwnerIds = activeDelegations.map(d => d.taskOwnerId)
    const delegatedStaffIds = staff
      .filter(s => delegatedTaskOwnerIds.includes(s.leadId || ''))
      .map(s => s.id)
    const projectOwnerStaffIds = Array.from(new Set(
      entries
        .filter(e => !e.deleted && (e.leadId === user.id || (e.lead || '').trim().toLowerCase() === normalizedUserName))
        .map(e => e.staffId)
    ))
    if (user.role === 'admin') {
      return entries.filter(e =>
        ['submitted', 'resubmitted', 'pending_2nd_approval', 'pending_clarification'].includes(e.status) && !e.deleted
      )
    }
    const myStaffIds = staff.filter(s => s.leadId === user.id).map(s => s.id)
    const allIds = Array.from(new Set([...myStaffIds, ...delegatedStaffIds, ...projectOwnerStaffIds]))
    return entries.filter(e =>
      ['submitted', 'resubmitted', 'pending_clarification'].includes(e.status) &&
      allIds.includes(e.staffId) &&
      e.staffId !== user.id &&  // exclude own entries
      !e.deleted
    )
  }

  function canApproveTimesheets() {
    if (!user) return false
    if (['admin', 'team_lead'].includes(user.role)) return true
    const now = new Date()
    const hasActiveDelegation = approvalDelegations.some(d =>
      d.delegateId === user.id && d.isActive &&
      new Date(d.startDate) <= now && new Date(d.endDate) >= now
    )
    if (hasActiveDelegation) return true
    if (pendingApprovals().length > 0) return true
    const normalizedUserName = (user.name || '').trim().toLowerCase()
    return entries.some(e => !e.deleted && (e.leadId === user.id || (e.lead || '').trim().toLowerCase() === normalizedUserName))
  }

  function checkReminders() {
    if (!user || user.role !== 'admin') return
    const now = new Date()
    const wat = new Date(now.getTime() + 3600000)
    if (wat.getUTCDay() !== 1) return
    const reminderHour = 10
    if (wat.getUTCHours() < reminderHour) return
    const currentWeek = getWeekKey()
    const activeStaff = staff.filter(s => s.status === 'active' && !s.exemptFromTimesheet)
    activeStaff.forEach(s => {
      const hasSubmitted = entries.some(e => e.staffId === s.id && e.weekKey === currentWeek && ['submitted', 'approved', 'resubmitted'].includes(e.status))
      if (!hasSubmitted) {
        const already = notifications.find(n =>
          n.userId === s.id && n.type === 'reminder' && n.createdAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)
        )
        if (!already) notify(s.id, '⏰ Reminder: Please submit your timesheet before Tuesday 4pm WAT', 'reminder')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Timesheet core logic
  // ---------------------------------------------------------------------------
  function calculateWeekCap(target: Staff | null, weekKey: string): { cap: number, isHoliday: boolean, isCDS: boolean } {
    const caps = settings?.hourCaps
    let baseCap = target?.weekly_cap ? Number(target.weekly_cap) : (caps?.defaultStaffCap || 40)
    if (target?.staffType === 'intern' && caps?.internCap) baseCap = caps.internCap
    const customCap = caps?.customCaps?.find(c => c.staffId === target?.id)
    if (customCap) baseCap = customCap.cap
    if (!target) return { cap: baseCap, isHoliday: false, isCDS: false }
    let cap = baseCap
    const isCDS = target.staffType === 'intern' && !!target.cdsDay
    if (isCDS) cap -= 8
    let isHoliday = false
    const holidays = publicHolidays || []
    const weekStart = new Date(weekKey)
    if (!isNaN(weekStart.getTime())) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekHolidays = holidays.filter(h => {
        const d = new Date(h.date)
        return d >= weekStart && d <= weekEnd
      })
      if (weekHolidays.length > 0) {
        weekHolidays.forEach(h => { cap -= (h.capReduction || 8) })
        isHoliday = true
      }
    }
    return { cap, isHoliday, isCDS }
  }

  async function updateEntry(entryId: string, updates: Partial<Entry>, adminOverride: boolean = false) {
    const isAdmin = user?.role === 'admin'
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return

    let finalUpdates = { ...updates, updatedAt: new Date().toISOString() }
    if (adminOverride && isAdmin) {
      const history: OverrideLog[] = entry.overrideHistory || []
      Object.keys(updates).forEach(key => {
        if ((updates as any)[key] !== (entry as any)[key]) {
          history.push({
            id: genId(), adminId: user?.id || '', adminName: user?.name || '',
            fieldName: key, oldValue: (entry as any)[key], newValue: (updates as any)[key],
            timestamp: new Date().toISOString()
          })
        }
      })
      finalUpdates = { ...finalUpdates, overrideHistory: history, overriddenBy: user?.name, overriddenAt: new Date().toISOString() } as any
    }

    const updatedEntries = entries.map(e => e.id === entryId ? { ...e, ...finalUpdates } : e)
    const pConfig = settings?.pointsConfig
    if (updates.status === 'approved') {
      const isCorrected = updates.correctionNote || updates.corrected
      notify(entry.staffId, `Your timesheet entry for ${entry.project} was approved${isCorrected ? ' with corrections' : ''}.`, 'entry_approved', 'Entry Approved', entry.id, 'entry')
      const p = (pConfig?.approvedEntry || 0) + (entry.hours || 0) * (pConfig?.hoursBonus || 0)
      awardPoints(entry.staffId, p, `Entry approved: ${entry.project}`, entry.weekKey)
      const weekEntries = updatedEntries.filter(e => e.staffId === entry.staffId && e.weekKey === entry.weekKey)
      const allApproved = weekEntries.every(e => e.status === 'approved')
      const noRejections = weekEntries.every(e => !e.approvalHistory?.some((h: any) => h.action === 'rejected'))
      if (allApproved && noRejections) {
        awardPoints(entry.staffId, pConfig?.perfectWeek || 0, 'Perfect Week Bonus', entry.weekKey)
        grantBadge(entry.staffId, 'perfect_week')
      }
    } else if (updates.status === 'rejected') {
      notify(entry.staffId, `Your timesheet entry for ${entry.project} was rejected.`, 'entry_rejected', 'Entry Rejected', entry.id, 'entry')
    } else if (updates.status === 'pending_clarification' || updates.status === 'clarification_needed') {
      notify(entry.staffId, `Clarification requested for your entry on ${entry.project}.`, 'clarification_requested', 'Clarification Requested', entry.id, 'entry')
    }

    saveEntries(updatedEntries)
  }

  async function submitWeekEntries(staffId: string, weekKey: string, totalHours: number) {
    const staffMember = staff.find(s => s.id === staffId)
    if (!staffMember) return

    const now = new Date()
    const weekStart = new Date(weekKey)
    const submissionId = `${staffId}_${weekKey}`

    const { getSubmissionWindowStatus } = await import('../lib/utils')
    const windowStatus = getSubmissionWindowStatus(settings?.submissionWindow)

    let deadline = new Date(weekStart)
    deadline.setDate(deadline.getDate() + 2)
    deadline.setHours(16, 0, 0, 0)
    const caps = settings?.hourCaps
    if (caps?.deadlineOverride) {
      const override = new Date(caps.deadlineOverride)
      if (!isNaN(override.getTime())) deadline = override
    }
    if (windowStatus.deadline) deadline = windowStatus.deadline

    const pConfig = settings?.pointsConfig || DEFAULT_POINTS
    let totalAward = 0
    let bonusDesc = ''
    let latePenalty = 0
    let isLate = false

    if (windowStatus.isPastDeadline && windowStatus.penalty < 0) {
      // Submitted after deadline — late penalty only, no on-time points
      isLate = true
      latePenalty = windowStatus.penalty
      totalAward = latePenalty
      bonusDesc = `Late submission (${Math.abs(latePenalty)} pts penalty)`
    } else if (windowStatus.isOpen) {
      // Submitted within the configured window — on-time points
      totalAward = pConfig.onTimeSubmission || 0
      bonusDesc = 'On-time submission'
    } else {
      // Window not yet open (e.g. submitted before window starts) — no points, no penalty
      totalAward = 0
      bonusDesc = 'Submission outside window'
    }

    const submission: WeekSubmission = {
      id: submissionId, staffId, weekKey, status: 'submitted',
      submittedAt: now.toISOString(), totalHours,
      latePenalty: isLate ? latePenalty : undefined, isLate
    }

    const secondLevelThreshold = (settings?.approvalWorkflow?.secondLevelThreshold as number) || 60
    const updatedEntries = entries.map(e => {
      if (e.staffId === staffId && e.weekKey === weekKey && e.status === 'draft') {
        const leadByName = e.lead ? staff.find(s => s.name.toLowerCase() === e.lead!.toLowerCase()) : null
        const leadId = e.leadId || staffMember.leadId || leadByName?.id || ''
        // Only skip team lead and go straight to admin review if it's a new task AND exceeds the hour threshold
        const status = (e.isNewTask && (e.hours || 0) >= secondLevelThreshold)
          ? 'pending_2nd_approval' as const
          : 'submitted' as const
        return { ...e, status, submittedAt: now.toISOString(), leadId }
      }
      return e
    })

    // Late penalty only applies to non-new-task entries
    const hasOnlyNewTasks = updatedEntries
      .filter(e => e.staffId === staffId && e.weekKey === weekKey)
      .every(e => e.isNewTask)
    if (hasOnlyNewTasks && isLate) {
      isLate = false
      latePenalty = 0
      totalAward = 0
      bonusDesc = 'New task submission'
    }

    // Save entries to DB first — must succeed before we show "Submitted" in the UI
    try {
      const changedEntries = updatedEntries.filter(e => e.staffId === staffId && e.weekKey === weekKey)
      await apiUpsert('entries', changedEntries, { throwOnError: true })
    } catch {
      toast.error('Submission failed — please try again.')
      return
    }
    // Only update UI state once DB write confirmed
    setEntries(updatedEntries)

    try {
      await fetch('/api/week-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      })
      logAudit('submit', submissionId, { staffId, weekKey, totalHours })

      const submittedEntries = updatedEntries.filter(e => e.staffId === staffId && e.weekKey === weekKey && e.status === 'submitted')
      const newTaskEntries = updatedEntries.filter(e => e.staffId === staffId && e.weekKey === weekKey && e.status === 'pending_2nd_approval')
      const targetLeads = Array.from(new Set(submittedEntries.map(e => e.leadId || staffMember.leadId).filter(Boolean)))
      const adminIds = staff.filter(s => s.role === 'admin').map(s => s.id)
      // Notify admins separately about new tasks requiring 2nd-level review
      if (newTaskEntries.length > 0) {
        adminIds.forEach(adminId => notify(adminId,
          `${staffMember.name} submitted ${newTaskEntries.length} new task${newTaskEntries.length > 1 ? 's' : ''} outside the submission window requiring your review.`,
          'submission_received', 'New Task — Admin Review Required', submissionId, 'entry'))
      }
      const allToNotify = Array.from(new Set([...targetLeads, ...adminIds]))
      allToNotify.forEach(lId => {
        notify(lId as string, `${staffMember.name} submitted their timesheet for week ${weekKey}`, 'submission_received', 'Timesheet Submitted', submissionId, 'entry')
      })

      if (totalAward !== 0) awardPoints(staffId, totalAward, bonusDesc, weekKey)

      const lastWeek = getWeekKey(subWeeks(new Date(weekKey), 1))
      const hasLastWeek = entries.some(e => e.staffId === staffId && e.weekKey === lastWeek && ['submitted', 'approved'].includes(e.status))
      const newStreak = hasLastWeek ? (staffMember.streak || 0) + 1 : 1
      const updatedStaff = staff.map(s => s.id === staffId ? { ...s, streak: newStreak, lastSubmittedWeek: weekKey } : s)
      saveStaff(updatedStaff)
      if (staffId === user?.id) updateUser({ streak: newStreak, lastSubmittedWeek: weekKey })
    } catch (e) { console.error('Week submission failed', e) }
  }

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value = {
    user, staff, entries, notifications: myNotifications,
    unreadCount, settings, darkMode, online, features, redeems,
    rewards, hof, projects, delegations, approvalDelegations, lockedWeeks, budgets, templates,
    projectBudgets, bulkImportLogs, bulkStaffImportLogs, streakRecoveries, pointsHistory,
    login, logout, updateUser, toggleDark,
    saveStaff, saveEntries, saveNotifications: saveNots,
    saveRedeems, saveRewards, saveHof,
    saveDelegations, saveApprovalDelegations, saveLockedWeeks, saveFeatures, saveSettings, saveProjects,
    saveBudgets, saveTemplates, saveProjectBudgets, saveBulkImportLogs, saveBulkStaffImportLogs,
    saveStreakRecoveries, savePointsHistory,
    notify, markRead, markAllRead,
    awardPoints, grantBadge,
    pendingApprovals, canApproveTimesheets,
    loadAll, checkReminders,
    idleCountdown, resetIdle, showPasswordChange, setShowPasswordChange,
    calculateWeekCap, updateEntry, submitWeekEntries,
    prefillTemplate, setPrefillTemplate,
    passwordResetRequests, savePasswordResetRequests,
    announcements, saveAnnouncements,
    weekLocks, saveWeekLocks,
    auditLogs, saveAuditLogs,
    publicHolidays, savePublicHolidays,
    logAudit,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

const DEFAULT_FEATURES = {
  leaderboard: true, gamification: true,
  analytics: true, bulk_import: true,
  dark_mode: true, pdf_export: true, org_chart: true, delegation: true,
}

const DEFAULT_POINTS_CONFIG = {
  onTimeSubmission: 10,
  approvedEntry: 10, approvedWithNote: 5, perfectWeek: 20,
  hoursBonus: 1, streakBonus: 15
}

const DEFAULT_SETTINGS: AppSettings = {
  branding: {
    appName: 'DSN Resource Management',
    welcomeMessage: 'Welcome back! Ready to log your hours?',
    primaryColour: '#076C04',
    secondaryColour: '#10B981',
    logoBase64: null,
  },
  featureToggles: {
    gamification: true, leaderboard: true, messaging: true, bulkImports: true,
    darkMode: true, twoFactorAdminsLeads: true, deadlineCountdown: true,
    firstLoginWalkthrough: true, approvalDelegation: true, pdfExport: true,
    profilePhotos: true, streakRecovery: true, duplicateDetection: true,
    announcements: true, orgChart: true,
  },
  pointsConfig: DEFAULT_POINTS_CONFIG,
  hourCaps: { defaultStaffCap: 45, internCap: 32, cdsVisibility: true, customCaps: [] },
  approvalWorkflow: { secondLevelEnabled: true, secondLevelThreshold: 60 },
  idleTimeout: { minutes: 30 },
  submissionWindow: {
    enabled: true,
    schedule: { startDay: 'monday' as const, startTime: '08:00', endDay: 'tuesday' as const, endTime: '16:00' },
    latePenalty: { enabled: true, pointsPerPeriod: -5, periodHours: 12 },
    timezone: 'Africa/Windhoek'
  },
  categories: ['Client Work', 'Internal', 'Training', 'Admin', 'Business Development', 'Research'],
}

const DEFAULT_PROJECTS = [
  { id: '1', name: 'Project Alpha', active: true, budget: 0 },
  { id: '2', name: 'Project Beta', active: true, budget: 0 },
  { id: '3', name: 'Internal Operations', active: true, budget: 0 },
  { id: '4', name: 'Business Development', active: true, budget: 0 },
  { id: '5', name: 'Training & Development', active: true, budget: 0 },
  { id: '6', name: 'Admin', active: true, budget: 0 },
]
