import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { local, logAudit, genId, DEFAULT_POINTS, BADGES, getWeekKey, registerSession, updateSessionHeartbeat, removeSession, syncToSupabase, fetchFromSupabase } from '../lib/utils'
import { getSupabase } from '../lib/supabase'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [staff, setStaff]             = useState([])
  const [entries, setEntries]         = useState([])
  const [messages, setMessages]       = useState([])
  const [notifications, setNots]      = useState([])
  const [settings, setSettings]       = useState(null)
  const [darkMode, setDarkMode]       = useState(true)
  const [online, setOnline]           = useState(navigator.onLine)
  const [features, setFeatures]       = useState(null)
  const [redeems, setRedeems]         = useState([])
  const [rewards, setRewards]         = useState([])
  const [hof, setHof]                 = useState([])
  const [projects, setProjects]       = useState([])
  const [leaves, setLeaves]           = useState([])
  const [delegations, setDelegations] = useState([])
  const [lockedWeeks, setLockedWeeks] = useState([])
  const [budgets, setBudgets]         = useState([])
  const [templates, setTemplates]     = useState([])

  const idleTimerRef = useRef(null)
  const heartbeatRef = useRef(null)
  const userRef      = useRef(null)

  useEffect(() => {
    const savedUser = local.get('session_user')
    if (savedUser) { setUser(savedUser); userRef.current = savedUser }
    loadAll()

    const dm = local.get('dark_mode', true)
    setDarkMode(dm)
    document.body.classList.toggle('light', !dm)

    const acts = ['mousemove','keydown','click','scroll','touchstart']
    const handler = () => resetIdle()
    acts.forEach(e => window.addEventListener(e, handler, { passive: true }))
    window.addEventListener('online',  () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))

    // Heartbeat every 60s
    heartbeatRef.current = setInterval(() => {
      if (userRef.current) updateSessionHeartbeat(userRef.current.id)
    }, 60000)

    return () => {
      acts.forEach(e => window.removeEventListener(e, handler))
      clearTimeout(idleTimerRef.current)
      clearInterval(heartbeatRef.current)
    }
  }, [])

  function resetIdle() {
    clearTimeout(idleTimerRef.current)
    const mins = local.get('settings')?.idle_minutes || 30
    idleTimerRef.current = setTimeout(() => {
      if (userRef.current) { logoutFn(userRef.current); }
    }, mins * 60 * 1000)
  }

  function loadAll() {
    // Seed the bootstrap admin if staff list is empty
    const SEED_ADMIN = {
      id: 'seed-admin-001',
      name: 'Adeniran',
      email: 'adeniran@datasciencenigeria.ai',
      department: 'Administration',
      role: 'admin',
      pin: '1234',
      first_login: true,
      points: 0,
      streak: 0,
      badges: [],
      suspended: false,
      createdAt: new Date().toISOString(),
    }
    const savedStaff = local.get('staff', [])
    const staffToLoad = savedStaff.length === 0 ? [SEED_ADMIN] : savedStaff
    // Ensure seed admin is always present even if staff was cleared
    const hasSeedAdmin = staffToLoad.some(s => s.email === 'adeniran@datasciencenigeria.ai')
    if (!hasSeedAdmin) staffToLoad.unshift(SEED_ADMIN)
    setStaff(staffToLoad)
    setEntries(local.get('entries', []))
    setMessages(local.get('messages', []))
    setNots(local.get('notifications', []))
    setRedeems(local.get('redeems', []))
    setRewards(local.get('rewards', []))
    setHof(local.get('hof', []))
    setProjects(local.get('projects', DEFAULT_PROJECTS))
    setLeaves(local.get('leaves', []))
    setDelegations(local.get('delegations', []))
    setLockedWeeks(local.get('locked_weeks', []))
    setFeatures(local.get('features', DEFAULT_FEATURES))
    setBudgets(local.get('budgets', []))
    setTemplates(local.get('templates', []))
    setSettings(local.get('settings') || DEFAULT_SETTINGS)
  }

  // Supabase real-time subscription setup
  useEffect(() => {
    const sb = getSupabase()
    if (!sb || !user) return
    // Subscribe to entries changes
    const sub = sb.channel('entries-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, payload => {
        loadAll() // Reload on any remote change
      })
      .subscribe()
    return () => sb.removeChannel(sub)
  }, [user])

  // Persist helpers with optional Supabase sync
  function saveStaff(data)      { setStaff(data);      local.set('staff', data);      syncToSupabase('staff', data) }
  function saveEntries(data)    { setEntries(data);    local.set('entries', data);    syncToSupabase('entries', data) }
  function saveMessages(data)   { setMessages(data);   local.set('messages', data) }
  function saveNots(data)       { setNots(data);       local.set('notifications', data) }
  function saveRedeems(data)    { setRedeems(data);    local.set('redeems', data) }
  function saveRewards(data)    { setRewards(data);    local.set('rewards', data) }
  function saveHof(data)        { setHof(data);        local.set('hof', data) }
  function saveLeaves(data)     { setLeaves(data);     local.set('leaves', data) }
  function saveDelegations(data){ setDelegations(data);local.set('delegations', data) }
  function saveLockedWeeks(data){ setLockedWeeks(data);local.set('locked_weeks', data) }
  function saveFeatures(data)   { setFeatures(data);   local.set('features', data) }
  function saveSettings(data)   { setSettings(data);   local.set('settings', data) }
  function saveProjects(data)   { setProjects(data);   local.set('projects', data) }
  function saveBudgets(data)    { setBudgets(data);    local.set('budgets', data) }
  function saveTemplates(data)  { setTemplates(data);  local.set('templates', data) }

  function login(staffMember) {
    const updated = { ...staffMember, last_login: new Date().toISOString() }
    setUser(updated)
    userRef.current = updated
    local.set('session_user', updated)
    registerSession(staffMember.id)
    logAudit('LOGIN', `${staffMember.name} logged in`, staffMember.id, staffMember.name)
    resetIdle()
  }

  function logoutFn(u) {
    const target = u || userRef.current
    if (target) {
      logAudit('LOGOUT', `${target.name} logged out`, target.id, target.name)
      removeSession(target.id)
    }
    setUser(null)
    userRef.current = null
    local.remove('session_user')
    clearTimeout(idleTimerRef.current)
  }

  function logout() { logoutFn(user) }

  function updateUser(updates) {
    const updated = { ...user, ...updates }
    setUser(updated)
    userRef.current = updated
    local.set('session_user', updated)
    const updatedStaff = staff.map(s => s.id === user.id ? { ...s, ...updates } : s)
    saveStaff(updatedStaff)
  }

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    local.set('dark_mode', next)
    document.body.classList.toggle('light', !next)
  }

  function notify(userId, message, type = 'info') {
    const notif = { id: genId(), userId, message, type, read: false, createdAt: new Date().toISOString() }
    const updated = [notif, ...local.get('notifications', [])]
    saveNots(updated)
    return notif
  }

  function markRead(notifId) {
    const updated = local.get('notifications', []).map(n => n.id === notifId ? { ...n, read: true } : n)
    saveNots(updated)
  }

  function markAllRead() {
    const updated = local.get('notifications', []).map(n => n.userId === user?.id ? { ...n, read: true } : n)
    saveNots(updated)
  }

  const myNotifications = notifications.filter(n => n.userId === user?.id)
  const unreadCount = myNotifications.filter(n => !n.read).length

  function awardPoints(staffId, points, reason) {
    const idx = staff.findIndex(s => s.id === staffId)
    if (idx === -1) return
    const updated = [...staff]
    const newPts = (updated[idx].points || 0) + points
    updated[idx] = { ...updated[idx], points: newPts }
    saveStaff(updated)
    if (staffId === user?.id) updateUser({ points: newPts })
    if (newPts >= 100 && !updated[idx].badges?.includes('centurion')) grantBadge(staffId, 'centurion')
  }

  function grantBadge(staffId, badgeId) {
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

  function pendingApprovals() {
    if (!user) return []
    // Check delegations — if admin delegated to this user
    const delegatedTo = delegations.filter(d => d.delegateeId === user.id && d.active && new Date(d.until) > new Date())
    const delegatedStaffIds = delegatedTo.flatMap(d => {
      const delegator = staff.find(s => s.id === d.delegatorId)
      return staff.filter(s => s.leadId === delegator?.id).map(s => s.id)
    })

    if (user.role === 'admin') return entries.filter(e => ['submitted','resubmitted'].includes(e.status) && !e.deleted)
    if (user.role === 'owner') {
      const myStaffIds = staff.filter(s => s.leadId === user.id).map(s => s.id)
      const allIds = [...new Set([...myStaffIds, ...delegatedStaffIds])]
      return entries.filter(e => ['submitted','resubmitted'].includes(e.status) && allIds.includes(e.staffId) && !e.deleted)
    }
    // Staff with delegation
    if (delegatedStaffIds.length > 0) {
      return entries.filter(e => ['submitted','resubmitted'].includes(e.status) && delegatedStaffIds.includes(e.staffId) && !e.deleted)
    }
    return []
  }

  function sendMessage(msg) {
    const newMsg = { ...msg, id: genId(), createdAt: new Date().toISOString(), read: [msg.senderId] }
    const updated = [newMsg, ...messages]
    saveMessages(updated)
    return newMsg
  }

  // Check submission reminders — call on login
  function checkReminders() {
    if (!user || user.role !== 'admin') return
    const now = new Date()
    const wat = new Date(now.getTime() + 3600000)
    if (wat.getUTCDay() !== 1) return // Only Monday
    const reminderHour = settings?.submission_reminder_hour || 10
    if (wat.getUTCHours() < reminderHour) return

    const currentWeek = getWeekKey()
    const activeStaff = staff.filter(s => !s.suspended && s.role === 'staff')
    activeStaff.forEach(s => {
      const hasSubmitted = entries.some(e => e.staffId === s.id && e.weekKey === currentWeek && ['submitted','approved','resubmitted'].includes(e.status))
      if (!hasSubmitted) {
        const already = local.get('notifications', []).find(n => n.userId === s.id && n.type === 'reminder' && n.createdAt?.slice(0,10) === new Date().toISOString().slice(0,10))
        if (!already) notify(s.id, '⏰ Reminder: Please submit your timesheet before Tuesday 4pm WAT', 'reminder')
      }
    })
  }

  const value = {
    user, staff, entries, messages, notifications: myNotifications,
    unreadCount, settings, darkMode, online, features, redeems,
    rewards, hof, projects, leaves, delegations, lockedWeeks, budgets, templates,
    login, logout, updateUser, toggleDark,
    saveStaff, saveEntries, saveMessages, saveNotifications: saveNots,
    saveRedeems, saveRewards, saveHof, saveLeaves,
    saveDelegations, saveLockedWeeks, saveFeatures, saveSettings, saveProjects,
    saveBudgets, saveTemplates,
    notify, markRead, markAllRead,
    awardPoints, grantBadge,
    pendingApprovals, sendMessage, loadAll, checkReminders,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

const DEFAULT_FEATURES = {
  leaderboard: true, gamification: true, messages: true,
  analytics: true, leave_requests: true, bulk_import: true,
  dark_mode: true, pdf_export: true, org_chart: true, delegation: true,
}

const DEFAULT_SETTINGS = {
  app_name: 'DSN Resource Management',
  welcome_message: 'Welcome back! Ready to log your hours?',
  accent_color: '#3B82F6',
  weekly_cap: 45,
  idle_minutes: 30,
  submission_reminder_hour: 10,
  approval_reminder_hours: 24,
  second_level_threshold: 60,
  points: DEFAULT_POINTS,
  categories: ['Client Work','Internal','Training','Admin','Business Development','Research'],
  holidays: [],
  announcement: null,
}

const DEFAULT_PROJECTS = [
  { id: '1', name: 'Project Alpha', active: true, budget: 0 },
  { id: '2', name: 'Project Beta', active: true, budget: 0 },
  { id: '3', name: 'Internal Operations', active: true, budget: 0 },
  { id: '4', name: 'Business Development', active: true, budget: 0 },
  { id: '5', name: 'Training & Development', active: true, budget: 0 },
  { id: '6', name: 'Admin', active: true, budget: 0 },
]
