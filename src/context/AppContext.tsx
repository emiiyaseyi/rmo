'use client'
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { local, genId, DEFAULT_POINTS, BADGES, getWeekKey, registerSession, removeSession, sendEmailNotification } from '../lib/utils'
import { db } from '../lib/firebase'
import { doc, onSnapshot, updateDoc, increment, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, orderBy, writeBatch } from 'firebase/firestore'
import { format, subWeeks } from 'date-fns'
import { Staff, Entry, AppSettings, AppContextType, AppNotification, AppMessage, MessageThread, Leave, Redemption, Reward, HofEntry, OverrideLog, WeekSubmission, ApprovalDelegation, ProjectBudget, BulkImportLog, BulkStaffImportLog, StreakRecoveryRequest, PointsHistoryEntry, PasswordResetRequest, Announcement, WeekLock, AuditLog, PublicHoliday, Delegation } from '../types'

const AppCtx = createContext<AppContextType | null>(null)
export const useApp = () => useContext(AppCtx) as AppContextType

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [messages, setMessages] = useState<AppMessage[]>([])
  const [messageThreads, setMessageThreads] = useState<MessageThread[]>([])
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
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [delegations, setDelegations] = useState<any[]>([])
  const [approvalDelegations, setApprovalDelegations] = useState<ApprovalDelegation[]>([])
  const [lockedWeeks, setLockedWeeks] = useState<any[]>([]) // Legacy, to be replaced by weekLocks
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

  useEffect(() => {
    // ONE-TIME CLEANUP (MIGRATION TO SESSION STORAGE)
    if (typeof window !== 'undefined') {
       const migrated = sessionStorage.getItem('dsn_migrated_v3')
       if (!migrated) {
          localStorage.clear()
          sessionStorage.setItem('dsn_migrated_v3', 'true')
       }
    }

    // Session is now strictly in sessionStorage (via local helper as updated in Step 1)
    const savedUser = local.get<Staff | null>('session_user', null)
    if (savedUser) { setUser(savedUser); userRef.current = savedUser }
    
    // Initial fetch of settings and Bootstrapping
    const init = async () => {
      // Load Settings
      const settSnap = await getDoc(doc(db, 'settings', 'global'))
      if (settSnap.exists()) {
        const s = settSnap.data() as AppSettings
        setSettings({ ...DEFAULT_SETTINGS, ...s, featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...s.featureToggles } })
      }

      // Bootstrap Default Admin
      const adminEmail = 'adeniran@datasciencenigeria.ai'
      const staffRef = collection(db, 'staff')
      const q = query(staffRef, where('email', '==', adminEmail))
      const snap = await getDocs(q)
      
      if (snap.empty) {
        console.log('Bootstrapping default admin...')
        const adminId = 'admin-seed-001'
        const adminUser: Staff = {
          id: adminId,
          name: 'Adeniran',
          email: adminEmail,
          department: 'Administration',
          role: 'admin',
          password: 'admin',
          status: 'active',
          first_login: true,
          mustChangePassword: true,
          points: 0,
          badges: [],
          streak: 0,
          createdAt: new Date().toISOString()
        }
        await setDoc(doc(db, 'staff', adminId), adminUser)
      }
    }
    init()

    const dm = local.get<boolean>('dark_mode', false)
    setDarkMode(dm)
    document.body.classList.toggle('dark', dm)

    const acts = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    const handler = () => {
      // Only reset idle timer if countdown is NOT active
      // Once countdown starts, only explicit button clicks can dismiss it
      if (idleCountdown === null) {
        resetIdle()
      }
    }
    acts.forEach(e => window.addEventListener(e, handler, { passive: true }))
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))

    return () => {
      acts.forEach(e => window.removeEventListener(e, handler))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [idleCountdown])

  // Initialize default group channels
  useEffect(() => {
    if (messageThreads.length === 0 || !messageThreads.find(t => t.id === 'all_staff')) {
      const defaultChannels: MessageThread[] = [
        {
          id: 'all_staff',
          type: 'group',
          name: 'All Staff',
          icon: '📢',
          participants: staff.map(s => s.id),
          lastMessage: null,
          lastMessageAt: null,
          lastMessageBy: null,
          createdAt: new Date().toISOString()
        },
        {
          id: 'admin_team',
          type: 'group',
          name: 'Admin Team',
          icon: '🔒',
          participants: staff.filter(s => ['admin'].includes(s.role)).map(s => s.id),
          lastMessage: null,
          lastMessageAt: null,
          lastMessageBy: null,
          createdAt: new Date().toISOString()
        }
      ]

      const existingIds = messageThreads.map(t => t.id)
      const newChannels = defaultChannels.filter(ch => !existingIds.includes(ch.id))
      if (newChannels.length > 0) {
        saveMessageThreads([...messageThreads, ...newChannels])
      }
    }
  }, [staff.length, messageThreads.length])

  function resetIdle() {
    // Clear any existing countdown interval
    if ((idleTimerRef as any).currentCountdownInterval) {
      clearInterval((idleTimerRef as any).currentCountdownInterval)
      ;(idleTimerRef as any).currentCountdownInterval = null
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setIdleCountdown(null) // Clear countdown state
    const totalMins = settings?.idle_minutes || 2
    const warnAt = (totalMins * 60) - 30 // Start warning 30s before

    idleTimerRef.current = setTimeout(() => {
      // Start 30s countdown
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

      // Store interval to clear it later
      ;(idleTimerRef as any).currentCountdownInterval = interval

    }, warnAt * 1000)
  }

  // Idle countdown behavior:
  // - Before countdown: any activity resets the timer
  // - During countdown: only explicit button clicks (Stay Logged In) can dismiss it
  // - Mouse movement/hover does NOT dismiss the countdown modal

  // REAL-TIME SYNC FOR ALL COLLECTIONS
  useEffect(() => {
    if (!user) return
    const unsubs: Array<() => void> = []

    // 1. Staff
    unsubs.push(onSnapshot(collection(db, 'staff'), (snap) => {
      const data: Staff[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff))
      setStaff(data)
    }))

    // 2. Entries (User context specific or all if admin)
    const entriesRef = user.role === 'admin' ? collection(db, 'timesheetEntries') : query(collection(db, 'timesheetEntries'), where('staffId', '==', user.id))
    unsubs.push(onSnapshot(entriesRef, (snap) => {
      const data: Entry[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Entry))
      setEntries(data)
    }))

    // 3. Notifications
    unsubs.push(onSnapshot(query(collection(db, 'notifications'), where('userId', '==', user.id)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))
      setNots(data)
    }))

    // 4. Approval Delegations (own + delegated to me)
    unsubs.push(onSnapshot(query(collection(db, 'approvalDelegations'), where('taskOwnerId', '==', user.id)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalDelegation))
      setApprovalDelegations(prev => {
        const delegatedToMe = prev.filter(p => p.delegateId === user.id)
        const merged = [...delegatedToMe, ...data]
        const unique = new Map<string, ApprovalDelegation>()
        merged.forEach(d => unique.set(d.id, d))
        return Array.from(unique.values())
      })
    }))
    unsubs.push(onSnapshot(query(collection(db, 'approvalDelegations'), where('delegateId', '==', user.id)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalDelegation))
      setApprovalDelegations(prev => {
        const ownedByMe = prev.filter(p => p.taskOwnerId === user.id)
        const merged = [...ownedByMe, ...data]
        const unique = new Map<string, ApprovalDelegation>()
        merged.forEach(d => unique.set(d.id, d))
        return Array.from(unique.values())
      })
    }))

    // 4. Settings
    unsubs.push(onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const s = snap.data() as AppSettings
        setSettings({ ...DEFAULT_SETTINGS, ...s, featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...s.featureToggles } })
      }
    }))

    // 5. Message Threads
    unsubs.push(onSnapshot(query(collection(db, 'messageThreads'), where('participants', 'array-contains', user.id)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MessageThread))
      setMessageThreads(data)
    }))

    // 6. Leaves
    const leavesRef = user.role === 'admin' ? collection(db, 'leaves') : query(collection(db, 'leaves'), where('staffId', '==', user.id))
    unsubs.push(onSnapshot(leavesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Leave))
      setLeaves(data)
    }))

    // 7. Rewards/Redeems
    unsubs.push(onSnapshot(collection(db, 'rewards'), (snap) => {
      setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reward)))
    }))
    unsubs.push(onSnapshot(collection(db, 'redeems'), (snap) => {
      setRedeems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Redemption)))
    }))

    // 8. Announcements
    unsubs.push(onSnapshot(collection(db, 'announcements'), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)))
    }))

    // 9. Public Holidays
    unsubs.push(onSnapshot(collection(db, 'publicHolidays'), (snap) => {
      setPublicHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() } as PublicHoliday)))
    }))
    // 10. Audit Logs
    unsubs.push(onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))
        .slice(0, 2000))
    }))
    // 11. Projects
    unsubs.push(onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))

    return () => unsubs.forEach(u => u())
  }, [user?.id])

  // Clean up audit logs older than 3 months (90 days)
  useEffect(() => {
    if (!user || user.role !== 'admin') return // Only admins trigger cleanup

    const cleanupAuditLogs = async () => {
      try {
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        const cutoffDate = threeMonthsAgo.toISOString()

        const oldLogsQuery = query(
          collection(db, 'auditLogs'),
          where('timestamp', '<', cutoffDate)
        )

        const snapshot = await getDocs(oldLogsQuery)
        if (snapshot.empty) return

        console.log(`Cleaning up ${snapshot.size} audit logs older than 3 months...`)

        // Delete in batches to avoid exceeding Firestore limits
        const batch = writeBatch(db)
        snapshot.docs.forEach(doc => batch.delete(doc.ref))
        await batch.commit()

        console.log(`Successfully deleted ${snapshot.size} old audit logs`)
      } catch (error) {
        console.error('Failed to clean up old audit logs:', error)
      }
    }

    // Run cleanup on mount and then daily
    cleanupAuditLogs()
    const interval = setInterval(cleanupAuditLogs, 24 * 60 * 60 * 1000) // Run daily

    return () => clearInterval(interval)
  }, [user?.id, user?.role])

  // Helper to strip undefined values for Firebase
  const fbSafe = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj
    // Recursively clean arrays and nested objects if needed, but for now top-level is enough
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined))
  }

  function loadAll() {
    // loadAll is now mostly obsolete as real-time snapshots handle data loading 
    // but we can keep it for any static non-firestore data if needed.
  }



  // Firestore real-time listeners for messaging
  useEffect(() => {
    if (!user) return

    const unsubscribers: Array<() => void> = []

    // Listen to message threads
    const threadsQuery = query(
      collection(db, 'messageThreads'),
      where('participants', 'array-contains', user.id)
    )
    const unsubThreads = onSnapshot(threadsQuery, (snapshot) => {
      const threads: MessageThread[] = []
      snapshot.forEach((doc) => {
        threads.push({ id: doc.id, ...doc.data() } as MessageThread)
      })
      // Merge with local threads, preferring remote data
      setMessageThreads(prevThreads => {
        const merged = [...threads]
        prevThreads.forEach(local => {
          if (!merged.find(t => t.id === local.id)) {
            merged.push(local)
          }
        })
        local.set('message_threads', merged)
        return merged
      })
    }, (error) => {
      console.error('Thread listener error:', error)
    })
    unsubscribers.push(unsubThreads)

    // Listen to messages in user's threads
    // Note: This is a simplified approach. In production, you might want to
    // subscribe to each thread's messages subcollection separately
    const loadMessages = async () => {
      try {
        const userThreadIds = messageThreads
          .filter(t => t.participants.includes(user.id))
          .map(t => t.id)

        for (const threadId of userThreadIds) {
          const messagesQuery = query(
            collection(db, 'messages', threadId, 'messages')
          )
          const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
            const newMessages: AppMessage[] = []
            snapshot.forEach((doc) => {
              const data = doc.data()
              newMessages.push({
                id: doc.id,
                senderId: data.senderId,
                senderName: data.senderName,
                recipientId: data.recipientId,
                channelId: data.channelId,
                threadId,
                text: data.content || data.text,
                type: data.type,
                read: data.readBy || data.read || [],
                createdAt: data.sentAt || data.createdAt
              })
            })

            // Merge with existing messages
            setMessages(prev => {
              const merged = [...prev]
              newMessages.forEach(newMsg => {
                const existingIdx = merged.findIndex(m => m.id === newMsg.id)
                if (existingIdx >= 0) {
                  merged[existingIdx] = newMsg
                } else {
                  merged.push(newMsg)
                }
              })
              local.set('messages', merged)
              return merged
            })
          }, (error) => {
            console.error(`Messages listener error for thread ${threadId}:`, error)
          })
          unsubscribers.push(unsubMessages)
        }
      } catch (error) {
        console.error('Error setting up message listeners:', error)
      }
    }

    loadMessages()

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [user?.id, messageThreads.length])

  // Session Heartbeat & Security Listener
  useEffect(() => {
    if (!user) return

    // Centralized Session Tracking (Firebase)
    const sessionRef = doc(db, 'active_sessions', user.id)
    const pulse = async () => {
      try {
        await setDoc(sessionRef, {
          userId: user.id,
          userName: user.name,
          email: user.email,
          role: user.role,
          department: user.department || '',
          lastSeen: new Date().toISOString(),
          loginAt: user.last_login || new Date().toISOString()
        }, { merge: true })
      } catch (e) { console.error('Heartbeat failed', e) }
    }
    
    pulse()
    const heartbeat = setInterval(pulse, 30000)

    // Security Listener (Force Logout / Lockout)
    const userRef = doc(db, 'staff', user.id)
    const unsub = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      if (data.force_logout) {
        // Reset flag and logout
        updateDoc(userRef, { force_logout: false })
        logout()
        toast('Your session has been terminated by an administrator.', { icon: '🚫' })
      }
    })

    return () => {
      clearInterval(heartbeat)
      unsub()
      deleteDoc(sessionRef).catch(() => {}) // Cleanup on unmount (session end)
    }
  }, [user])

  // Persist helpers with optional Supabase sync
  function saveStaff(data: Staff[]) {
    const previousStaff = staff
    setStaff(data);
 
    // Efficient Sync to Firestore: only update changed members
    data.forEach(s => {
      const prev = previousStaff.find(p => p.id === s.id)
      if (!prev || JSON.stringify(prev) !== JSON.stringify(s)) {
        setDoc(doc(db, 'staff', s.id), s, { merge: true }).catch(() => {})
      }
    })

    // Auto-add new staff to "All Staff" channel
    const newStaffMembers = data.filter(s => !previousStaff.find(p => p.id === s.id))
    if (newStaffMembers.length > 0) {
      const allStaffThread = messageThreads.find(t => t.id === 'all_staff')
      if (allStaffThread) {
        const updatedThread = {
          ...allStaffThread,
          participants: Array.from(new Set([...allStaffThread.participants, ...newStaffMembers.map(s => s.id)]))
        }
        const updatedThreads = messageThreads.map(t => t.id === 'all_staff' ? updatedThread : t)
        saveMessageThreads(updatedThreads)
      }

      // Auto-add new admins to "Admin Team" channel
      const newAdmins = newStaffMembers.filter(s => ['admin'].includes(s.role))
      if (newAdmins.length > 0) {
        const adminTeamThread = messageThreads.find(t => t.id === 'admin_team')
        if (adminTeamThread) {
          const updatedThread = {
            ...adminTeamThread,
            participants: Array.from(new Set([...adminTeamThread.participants, ...newAdmins.map(s => s.id)]))
          }
          const updatedThreads = messageThreads.map(t => t.id === 'admin_team' ? updatedThread : t)
          saveMessageThreads(updatedThreads)
        }
      }
    }
  }
  function saveEntries(data: Entry[]) { 
    setEntries(data); 

    // Sync to Firestore
    data.forEach(e => {
      setDoc(doc(db, 'timesheetEntries', e.id), e, { merge: true }).catch(() => {})
    })
  }
  function saveMessages(data: AppMessage[]) {
    setMessages(data);
    // Sync to Firestore - organized by thread
    data.forEach(msg => {
      const threadId = msg.threadId || msg.channelId || (msg.recipientId ? `dm_${msg.senderId}_${msg.recipientId}` : '')
      if (threadId) {
        // Remove undefined fields for Firebase compatibility
        const cleanMsg = Object.fromEntries(Object.entries(msg).filter(([_, v]) => v !== undefined))
        setDoc(doc(db, 'messages', threadId, 'messages', msg.id), cleanMsg, { merge: true }).catch(err => {
          if (!err.message?.includes('id-token-expired')) console.error('Failed to sync message:', err)
        })
      }
    })
  }
  function saveMessageThreads(data: MessageThread[]) {
    setMessageThreads(data);
    // Sync to Firestore
    data.forEach(thread => {
      setDoc(doc(db, 'messageThreads', thread.id), thread, { merge: true }).catch(() => {})
    })
  }
  function saveNots(data: AppNotification[]) { 
    setNots(data); 
    data.forEach(n => { 
      const prev = notifications.find(p => p.id === n.id)
      if (!prev || prev.read !== n.read) {
        setDoc(doc(db, 'notifications', n.id), fbSafe(n), { merge: true }).catch(() => {}) 
      }
    }) 
  }
  function saveRedeems(data: Redemption[]) {
    data.forEach(r => { setDoc(doc(db, 'redeems', r.id), r, { merge: true }).catch(() => {}) })
  }
  function saveRewards(data: Reward[]) {
    data.forEach(r => { setDoc(doc(db, 'rewards', r.id), r, { merge: true }).catch(() => {}) })
  }
  function saveHof(data: HofEntry[]) {
    data.forEach(h => { setDoc(doc(db, 'hof', h.id), fbSafe(h), { merge: true }).catch(() => {}) })
  }
  function saveLeaves(data: Leave[]) {
    setLeaves(data);
    data.forEach(l => { setDoc(doc(db, 'leaves', l.id), fbSafe(l), { merge: true }).catch(() => {}) })
  }
  function saveSettings(data: AppSettings) {
    setSettings(data);
    setDoc(doc(db, 'settings', 'global'), fbSafe(data), { merge: true }).catch(() => {})
  }
  function saveAnnouncements(data: Announcement[]) {
    setAnnouncements(data);
    data.forEach(a => { setDoc(doc(db, 'announcements', a.id), fbSafe(a), { merge: true }).catch(() => {}) })
  }
  function savePublicHolidays(data: PublicHoliday[]) {
    setPublicHolidays(data);
    data.forEach(h => { setDoc(doc(db, 'publicHolidays', h.id), fbSafe(h), { merge: true }).catch(() => {}) })
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
    data.forEach(log => { setDoc(doc(db, 'auditLogs', log.id), log, { merge: true }).catch(() => {}) })
  }
  function saveDelegations(data: Delegation[]) {
    data.forEach(d => { setDoc(doc(db, 'delegations', d.id), d, { merge: true }).catch(() => {}) })
  }
  function saveApprovalDelegations(data: ApprovalDelegation[]) {
    setApprovalDelegations(data)
    localStorage.setItem('approvalDelegations', JSON.stringify(data))
    data.forEach(d => { setDoc(doc(db, 'approvalDelegations', d.id), d, { merge: true }).catch(() => {}) })
  }
  function saveLockedWeeks(data: string[]) {
     setDoc(doc(db, 'settings', 'lockedWeeks'), { lockedWeeks: data }, { merge: true }).catch(() => {})
  }
  function saveFeatures(data: any) {
     setDoc(doc(db, 'settings', 'features'), fbSafe(data), { merge: true }).catch(() => {})
  }
  function saveWeekLocks(data: WeekLock[]) {
    data.forEach(lock => { setDoc(doc(db, 'weekLocks', lock.id), fbSafe(lock), { merge: true }).catch(() => {}) })
  }
  function saveProjects(data: any[]) {
    data.forEach(p => { setDoc(doc(db, 'projects', p.id), fbSafe(p), { merge: true }).catch(() => {}) })
  }
  function saveBudgets(data: any[]) {
    data.forEach(b => { setDoc(doc(db, 'budgets', b.id), fbSafe(b), { merge: true }).catch(() => {}) })
  }
  function saveTemplates(data: any[]) {
    data.forEach(t => { setDoc(doc(db, 'templates', t.id), fbSafe(t), { merge: true }).catch(() => {}) })
  }
  function saveProjectBudgets(data: ProjectBudget[]) {
    data.forEach(b => { setDoc(doc(db, 'projectBudgets', b.id), fbSafe(b), { merge: true }).catch(() => {}) })
  }
  function saveBulkImportLogs(data: BulkImportLog[]) {
    data.forEach(l => { setDoc(doc(db, 'bulkImportLogs', l.id), fbSafe(l), { merge: true }).catch(() => {}) })
  }
  function saveBulkStaffImportLogs(data: BulkStaffImportLog[]) {
    data.forEach(l => { setDoc(doc(db, 'bulkStaffImportLogs', l.id), fbSafe(l), { merge: true }).catch(() => {}) })
  }
  function saveStreakRecoveries(data: StreakRecoveryRequest[]) { 
    data.forEach(r => { setDoc(doc(db, 'streakRecoveries', r.id), fbSafe(r), { merge: true }).catch(() => {}) })
  }
  function savePointsHistory(data: PointsHistoryEntry[]) { 
    data.forEach(h => { setDoc(doc(db, 'pointsHistory', h.id), fbSafe(h), { merge: true }).catch(() => {}) })
  }
  function savePasswordResetRequests(data: PasswordResetRequest[]) {
    data.forEach(r => { 
      setDoc(doc(db, 'passwordResetRequests', r.id), fbSafe(r), { merge: true }).catch(() => {})
      // Notify Admin when a new request is made
      if (r.status === 'pending') {
        const admins = staff.filter(s => s.role === 'admin')
        const requester = staff.find(s => s.id === r.staffId)
        admins.forEach(admin => {
          notify(admin.id, `Password reset requested by ${requester?.name || 'Staff'}`, 'password_reset_request', 'Reset Request', r.id, 'request')
        })
      }
    }) 
  }

  async function login(staffMember: Staff) {
    // Enforce domain
    if (!staffMember.email.endsWith('@datasciencenigeria.ai')) {
      throw new Error('Unauthorized domain. Please use your @datasciencenigeria.ai email.')
    }

    // Check status
    if (staffMember.status === 'suspended' || staffMember.suspended) {
      throw new Error('Your account has been suspended. Please contact administrator.')
    }

    // Check lockout
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

    // Clear failed attempts on success
    try {
      await setDoc(doc(db, 'staff', staffMember.id), { failed_attempts: 0, lockout_until: null, force_logout: false }, { merge: true })
    } catch (e) { console.error('Failed to clear login security state:', e) }

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
    const updatedStaff = staff.map(s => s.id === user.id ? { ...s, ...updates } : s)
    saveStaff(updatedStaff)
  }

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    local.set('dark_mode', next)
    document.body.classList.toggle('dark', next)
  }

  function notify(userId: string, message: string, type = 'info', title = 'New Notification', linkedId?: string, linkedType?: string, overrideEmail?: string, sendEmail = true) {
    // Provide defaults for optional fields to avoid undefined
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
    const updated = [notif, ...local.get<AppNotification[]>('notifications', [])]
    saveNots(updated)

    // Only send email if sendEmail flag is true
    // For routine notifications (timesheets, leave approvals), only send in-app notifications
    const targetUser = staff.find(s => s.id === userId)
    const targetEmail = overrideEmail || targetUser?.email

    if (sendEmail && targetEmail && targetEmail.endsWith('@datasciencenigeria.ai')) {
       // Skip email for routine notifications (timesheets, leave approvals, delegations)
       // These are better handled as in-app notifications for all users
       const isRoutineNotification = ['approval', 'leave_request', 'delegation_assigned'].includes(type)

       if (isRoutineNotification) {
         // All users get in-app notification only for routine items
         console.log(`Skipping email for routine notification: ${title}`)
       } else {
         // Send email for critical notifications (password resets, welcome emails, system alerts, etc.)
         let link = ''
         if (linkedType === 'entry') link = `/approvals`
         else if (linkedType === 'leave') link = `/staff`
         else if (linkedType === 'message') link = `/messages`
         else if (linkedId) link = `/dashboard` // generic fallback
         sendEmailNotification(targetEmail, title || 'New Notification', message, link)
       }
    }

    return notif
  }

  function markRead(notifId: string) {
    const updated = local.get<AppNotification[]>('notifications', []).map(n => n.id === notifId ? { ...n, read: true } : n)
    saveNots(updated)
  }

  function markAllRead() {
    const updated = local.get<AppNotification[]>('notifications', []).map(n => n.userId === user?.id ? { ...n, read: true } : n)
    saveNots(updated)
  }

  const myNotifications = notifications.filter(n => n.userId === user?.id)
  const unreadCount = myNotifications.filter(n => !n.read).length

  function awardPoints(staffId: string, points: number, action: string, weekId: string = getWeekKey()) {
    const idx = staff.findIndex(s => s.id === staffId)
    if (idx === -1) return
    const updated = [...staff]
    const s = updated[idx]
    
    const newTotal = (s.points || 0) + points
    const newWeekPoints = (s.currentWeekPoints || 0) + (weekId === getWeekKey() ? points : 0)
    
    updated[idx] = { 
      ...s, 
      points: newTotal, 
      currentWeekPoints: newWeekPoints,
      lastSubmittedWeek: weekId
    }
    
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
    
    // Badge checks could be here or triggered elsewhere
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

  function pendingApprovals() {
    if (!user) return []
    const normalizedUserName = (user.name || '').trim().toLowerCase()

    // Check active approval delegations
    const now = new Date()
    const activeDelegations = approvalDelegations.filter(d =>
      d.isActive &&
      d.delegateId === user.id &&
      new Date(d.startDate) <= now &&
      new Date(d.endDate) >= now
    )

    // Get staff IDs from delegated task owners
    const delegatedTaskOwnerIds = activeDelegations.map(d => d.taskOwnerId)
    const delegatedStaffIds = staff
      .filter(s => delegatedTaskOwnerIds.includes(s.leadId || ''))
      .map(s => s.id)

    // Staff can be project/task owners even without team_lead role
    const projectOwnerStaffIds = Array.from(
      new Set(
        entries
          .filter(e => !e.deleted && (e.leadId === user.id || (e.lead || '').trim().toLowerCase() === normalizedUserName))
          .map(e => e.staffId)
      )
    )

    // Admin sees all pending and 2nd-level approvals
    if (user.role === 'admin') {
      return entries.filter(e =>
        ['submitted', 'resubmitted', 'pending_2nd_approval', 'pending_clarification'].includes(e.status) && !e.deleted
      )
    }

    // Team leads, delegates and project/task owners can approve eligible entries
    const myStaffIds = staff.filter(s => s.leadId === user.id).map(s => s.id)
    const allIds = Array.from(new Set([...myStaffIds, ...delegatedStaffIds, ...projectOwnerStaffIds]))

    return entries.filter(e =>
      ['submitted', 'resubmitted', 'pending_clarification'].includes(e.status) &&
      allIds.includes(e.staffId) &&
      !e.deleted
    )
  }

  function canApproveTimesheets() {
    if (!user) return false
    if (['admin', 'team_lead'].includes(user.role)) return true
    if (pendingApprovals().length > 0) return true
    const normalizedUserName = (user.name || '').trim().toLowerCase()
    return entries.some(e => !e.deleted && (e.leadId === user.id || (e.lead || '').trim().toLowerCase() === normalizedUserName))
  }

  // Thread Management Functions
  function getOrCreateThread(type: 'direct' | 'group', participants: string[], name?: string, icon?: string): MessageThread {
    if (!user) throw new Error('User not logged in')

    // For direct messages, normalize participant order for consistent thread ID
    let threadId = ''
    if (type === 'direct') {
      const sorted = [...participants].sort()
      threadId = `dm_${sorted.join('_')}`
    } else {
      // For group channels, use a consistent ID
      threadId = name?.toLowerCase().replace(/\s+/g, '_') || genId()
    }

    // Check if thread already exists
    let thread = messageThreads.find(t => t.id === threadId)

    if (!thread) {
      thread = {
        id: threadId,
        type,
        name: name || null,
        icon: icon || null,
        participants,
        lastMessage: null,
        lastMessageAt: null,
        lastMessageBy: null,
        createdAt: new Date().toISOString()
      }
      const updatedThreads = [...messageThreads, thread]
      saveMessageThreads(updatedThreads)
    }

    return thread
  }

  function getThreadMessages(threadId: string): AppMessage[] {
    return messages
      .filter(m => {
        // Match by threadId or legacy channelId/DM logic
        if (m.threadId === threadId) return true
        if (m.channelId === threadId) return true

        // Handle legacy DM format
        if (threadId.startsWith('dm_')) {
          const parts = threadId.replace('dm_', '').split('_')
          if (m.type === 'dm' && parts.length === 2) {
            return (m.senderId === parts[0] && m.recipientId === parts[1]) ||
                   (m.senderId === parts[1] && m.recipientId === parts[0])
          }
        }
        return false
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  function getThreadUnreadCount(threadId: string): number {
    if (!user) return 0

    const threadMessages = getThreadMessages(threadId)
    return threadMessages.filter(m => m.senderId !== user.id && !m.read.includes(user.id)).length
  }

  function sendMessage(msg: Partial<AppMessage>) {
    const threadId = msg.threadId || msg.channelId || (msg.recipientId ? `dm_${[user?.id, msg.recipientId].sort().join('_')}` : '')

    const newMsg: AppMessage = {
      id: genId(),
      senderId: msg.senderId || user?.id || '',
      senderName: msg.senderName || user?.name || '',
      text: msg.text || '',
      type: msg.type || 'channel',
      channelId: msg.channelId,
      recipientId: msg.recipientId,
      threadId,
      createdAt: new Date().toISOString(),
      read: [msg.senderId || user?.id || '']
    }
    const updated = [newMsg, ...messages]
    saveMessages(updated)

    // Update thread's last message
    const thread = messageThreads.find(t => t.id === threadId)
    if (thread) {
      const updatedThread = {
        ...thread,
        lastMessage: newMsg.text,
        lastMessageAt: newMsg.createdAt,
        lastMessageBy: newMsg.senderId
      }
      const updatedThreads = messageThreads.map(t => t.id === threadId ? updatedThread : t)
      saveMessageThreads(updatedThreads)
    }

    // Notify recipient of DM
    if (newMsg.recipientId) {
      notify(newMsg.recipientId, `You have a new message from ${newMsg.senderName}`, 'message_received', 'New Message', newMsg.id, 'message')
    }

    return newMsg
  }

  // Check submission reminders — call on login
  function checkReminders() {
    if (!user || user.role !== 'admin') return
    const now = new Date()
    const wat = new Date(now.getTime() + 3600000)
    if (wat.getUTCDay() !== 1) return // Only Monday
    const reminderHour = 10 // Hardcoded default or move to settings if needed
    if (wat.getUTCHours() < reminderHour) return

    const currentWeek = getWeekKey()
    const activeStaff = staff.filter(s => s.status === 'active' && !s.exemptFromTimesheet)
    activeStaff.forEach(s => {
      const hasSubmitted = entries.some(e => e.staffId === s.id && e.weekKey === currentWeek && ['submitted', 'approved', 'resubmitted'].includes(e.status))
      if (!hasSubmitted) {
        const already = local.get<AppNotification[]>('notifications', []).find(n => n.userId === s.id && n.type === 'reminder' && n.createdAt?.slice(0, 10) === new Date().toISOString().slice(0, 10))
        if (!already) notify(s.id, '⏰ Reminder: Please submit your timesheet before Tuesday 4pm WAT', 'reminder')
      }
    })
  }

  // Timesheet Core Logic
  function calculateWeekCap(target: Staff | null, weekKey: string): { cap: number, isHoliday: boolean, isCDS: boolean } {
    const caps = settings?.hourCaps
    let baseCap = target?.weekly_cap ? Number(target.weekly_cap) : (caps?.defaultStaffCap || 40)
    
    // Check if target is intern and has intern cap
    if (target?.staffType === 'intern' && caps?.internCap) {
       baseCap = caps.internCap
    }

    // Check custom caps (per staff)
    const customCap = caps?.customCaps?.find(c => c.staffId === target?.id)
    if (customCap) baseCap = customCap.cap

    if (!target) return { cap: baseCap, isHoliday: false, isCDS: false }
    
    let cap = baseCap
    const isIntern = target.staffType === 'intern'
    const isCDS = isIntern && !!target.cdsDay
    
    if (isCDS) cap -= 8 // Deduct 8h for CDS day (could also be dynamic if needed)
    
    let isHoliday = false
    
    // Check holidays
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
        weekHolidays.forEach(h => {
          cap -= (h.capReduction || 8)
        })
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
            id: genId(),
            adminId: user?.id || '',
            adminName: user?.name || '',
            fieldName: key,
            oldValue: (entry as any)[key],
            newValue: (updates as any)[key],
            timestamp: new Date().toISOString()
          })
        }
      })
      finalUpdates = { ...finalUpdates, overrideHistory: history, overriddenBy: user?.name, overriddenAt: new Date().toISOString() } as any
    }

    const updatedEntries = entries.map(e => e.id === entryId ? { ...e, ...finalUpdates } : e)
    
    // Point Triggers
    const pConfig = settings?.pointsConfig
    if (updates.status === 'approved') {
      const isCorrected = updates.correctionNote || updates.corrected
      notify(entry.staffId, `Your timesheet entry for ${entry.project} was approved${isCorrected ? ' with corrections' : ''}.`, 'entry_approved', 'Entry Approved', entry.id, 'entry')

      const p = (pConfig?.approvedEntry || 0) + (entry.hours || 0) * (pConfig?.hoursBonus || 0)
      awardPoints(entry.staffId, p, `Entry approved: ${entry.project}`, entry.weekKey)
      
      // Perfect Week Check
      const weekEntries = updatedEntries.filter(e => e.staffId === entry.staffId && e.weekKey === entry.weekKey)
      const allApproved = weekEntries.every(e => e.status === 'approved')
      const noRejections = weekEntries.every(e => !e.approvalHistory?.some(h => h.action === 'rejected'))
      if (allApproved && noRejections) {
        awardPoints(entry.staffId, pConfig?.perfectWeek || 0, 'Perfect Week Bonus', entry.weekKey)
        grantBadge(entry.staffId, 'perfect_week')
      }
    } else if (updates.status === 'rejected') {
      notify(entry.staffId, `Your timesheet entry for ${entry.project} was rejected.`, 'entry_rejected', 'Entry Rejected', entry.id, 'entry')
      awardPoints(entry.staffId, pConfig?.rejectionDeduction || 0, `Entry rejected: ${entry.project}`, entry.weekKey)
    } else if (updates.status === 'pending_clarification' || updates.status === 'clarification_needed') {
      notify(entry.staffId, `Clarification requested for your entry on ${entry.project}.`, 'clarification_requested', 'Clarification Requested', entry.id, 'entry')
    }

    saveEntries(updatedEntries)

    // Sync to Firestore
    try {
      await setDoc(doc(db, 'timesheetEntries', entryId), { ...entry, ...finalUpdates }, { merge: true })
    } catch (e) { console.error('Firestore entry sync failed', e) }
  }

  async function submitWeekEntries(staffId: string, weekKey: string, totalHours: number) {
    const staffMember = staff.find(s => s.id === staffId)
    if (!staffMember) return

    const now = new Date()
    const weekStart = new Date(weekKey)
    const submissionId = `${staffId}_${weekKey}`

    // Get submission window status using the new configuration
    const { getSubmissionWindowStatus } = await import('../lib/utils')
    const windowStatus = getSubmissionWindowStatus(settings?.submissionWindow)

    // Deadline Override Logic (legacy support)
    let deadline = new Date(weekStart)
    deadline.setDate(deadline.getDate() + 1) // Monday
    deadline.setDate(deadline.getDate() + 1) // Tuesday
    deadline.setHours(16, 0, 0, 0) // 4:00pm

    const caps = settings?.hourCaps
    if (caps?.deadlineOverride) {
       const override = new Date(caps.deadlineOverride)
       if (!isNaN(override.getTime())) deadline = override
    }

    // Use window deadline if configured
    if (windowStatus.deadline) {
      deadline = windowStatus.deadline
    }

    // New Gamification Point Logic
    const pConfig = settings?.pointsConfig || DEFAULT_POINTS
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, 2=Tue...
    const hour = now.getHours()

    let totalAward = pConfig.onTimeSubmission || 0
    let bonusDesc = 'On-time submission'
    let latePenalty = 0
    let isLate = false

    // Check if submission is late using window status
    if (windowStatus.isPastDeadline && windowStatus.penalty < 0) {
      isLate = true
      latePenalty = windowStatus.penalty
      totalAward += latePenalty // Add negative penalty
      bonusDesc = `Late submission (${Math.abs(latePenalty)} pts penalty, ${windowStatus.periodsLate} period${windowStatus.periodsLate !== 1 ? 's' : ''} late)`
    } else {
      // Apply on-time bonuses
      if (dayOfWeek === 1) { // Monday
        totalAward += (pConfig.mondayBonus || 0)
        bonusDesc += ' + Monday Bonus'
      } else if (dayOfWeek === 2 && hour < 10) { // Tuesday Early
        totalAward += (pConfig.earlyBonus || 0)
        bonusDesc += ' + Early Bonus'
      }
    }

    const submission: WeekSubmission = {
      id: submissionId,
      staffId,
      weekKey,
      status: 'submitted',
      submittedAt: now.toISOString(),
      totalHours,
      latePenalty: isLate ? latePenalty : undefined,
      isLate
    }

    // Update entries status and ensure leadId is set
    const updatedEntries = entries.map(e => {
      if (e.staffId === staffId && e.weekKey === weekKey && e.status === 'draft') {
        // Inherit leadId from staff member if not set
        const leadId = e.leadId || staffMember.leadId || ''
        return { ...e, status: 'submitted' as const, submittedAt: now.toISOString(), leadId }
      }
      return e
    })
    saveEntries(updatedEntries)

    // Save submission record
    try {
      await setDoc(doc(db, 'weekSubmissions', submissionId), submission)
      logAudit('submit', submissionId, { staffId, weekKey, totalHours })
      
      // Notify Task Owners/Admins
      const submittedEntries = updatedEntries.filter(e => e.staffId === staffId && e.weekKey === weekKey && e.status === 'submitted')
      const targetLeads = Array.from(new Set(submittedEntries.map(e => e.leadId || staffMember.leadId).filter(Boolean)))
      const adminIds = staff.filter(s => s.role === 'admin').map(s => s.id)
      const allToNotify = Array.from(new Set([...targetLeads, ...adminIds]))
      
      allToNotify.forEach(lId => {
         notify(lId as string, `${staffMember.name} submitted their timesheet for week ${weekKey}`, 'submission_received', 'Timesheet Submitted', submissionId, 'entry')
      })

      // Award points
      if (totalAward !== 0) awardPoints(staffId, totalAward, bonusDesc, weekKey)
      
      // Update streak
      const lastWeek = getWeekKey(subWeeks(new Date(weekKey), 1))
      const hasLastWeek = entries.some(e => e.staffId === staffId && e.weekKey === lastWeek && ['submitted', 'approved'].includes(e.status))
      const newStreak = hasLastWeek ? (staffMember.streak || 0) + 1 : 1
      const updatedStaff = staff.map(s => s.id === staffId ? { ...s, streak: newStreak, lastSubmittedWeek: weekKey } : s)
      saveStaff(updatedStaff)
      if (staffId === user?.id) updateUser({ streak: newStreak, lastSubmittedWeek: weekKey })

    } catch (e) { console.error('Week submission failed', e) }
  }

  const unreadMessageCount = messages.filter(m => m.recipientId === user?.id && !m.read.includes(user?.id || '')).length

  const value = {
    user, staff, entries, messages, messageThreads, notifications: myNotifications,
    unreadCount, unreadMessageCount, settings, darkMode, online, features, redeems,
    rewards, hof, projects, leaves, delegations, approvalDelegations, lockedWeeks, budgets, templates,
    projectBudgets, bulkImportLogs, bulkStaffImportLogs, streakRecoveries, pointsHistory,
    login, logout, updateUser, toggleDark,
    saveStaff, saveEntries, saveMessages, saveMessageThreads, saveNotifications: saveNots,
    saveRedeems, saveRewards, saveHof, saveLeaves,
    saveDelegations, saveApprovalDelegations, saveLockedWeeks, saveFeatures, saveSettings, saveProjects,
    saveBudgets, saveTemplates, saveProjectBudgets, saveBulkImportLogs, saveBulkStaffImportLogs,
    saveStreakRecoveries, savePointsHistory,
    notify, markRead, markAllRead,
    awardPoints, grantBadge,
    pendingApprovals, canApproveTimesheets, sendMessage, getOrCreateThread, getThreadMessages, getThreadUnreadCount,
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
  leaderboard: true, gamification: true, messages: true,
  analytics: true, leave_requests: true, bulk_import: true,
  dark_mode: true, pdf_export: true, org_chart: true, delegation: true,
}

const DEFAULT_POINTS_CONFIG = {
  onTimeSubmission: 10,
  mondayBonus: 5,
  earlyBonus: 5,
  approvedEntry: 10,
  approvedWithNote: 5,
  perfectWeek: 20,
  hoursBonus: 1,
  streakBonus: 15,
  rejectionDeduction: -5
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
    gamification: true,
    leaderboard: true,
    messaging: true,
    bulkImports: true,
    darkMode: true,
    twoFactorAdminsLeads: true,
    deadlineCountdown: true,
    firstLoginWalkthrough: true,
    approvalDelegation: true,
    pdfExport: true,
    profilePhotos: true,
    streakRecovery: true,
    duplicateDetection: true,
    announcements: true,
    orgChart: true,
  },
  pointsConfig: DEFAULT_POINTS_CONFIG,
  hourCaps: {
    defaultStaffCap: 45,
    internCap: 32,
    cdsVisibility: true,
    customCaps: []
  },
  approvalWorkflow: {
    secondLevelEnabled: true,
    secondLevelThreshold: 60
  },
  idleTimeout: {
    minutes: 30
  },
  submissionWindow: {
    enabled: true,
    schedule: {
      startDay: 'monday' as const,
      startTime: '08:00',
      endDay: 'tuesday' as const,
      endTime: '16:00'
    },
    latePenalty: {
      enabled: true,
      pointsPerPeriod: -5,
      periodHours: 12
    },
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
