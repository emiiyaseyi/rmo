const PREFIX = 'dsn_'

export const local = {
  get: <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
      const v = sessionStorage.getItem(PREFIX + key)
      return v ? (JSON.parse(v) as T) : fallback
    } catch { return fallback }
  },
  set: (key: string, val: any): void => {
    if (typeof window === 'undefined') return;
    try { sessionStorage.setItem(PREFIX + key, JSON.stringify(val)) } catch { }
  },
  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(PREFIX + key);
  },
}

export function logAudit(action: string, detail: string, userId: string, userName: string): void {
  const id = Date.now().toString() + Math.random().toString(36).slice(2, 8)
  const timestamp = new Date().toISOString()
  const device = typeof navigator !== 'undefined'
    ? `${navigator.platform} (${navigator.language}) | ${navigator.userAgent.slice(0, 80)}`
    : 'unknown'
  const entry = {
    id,
    action,
    detail,
    userId,
    userName,
    performedBy: userName || 'System',
    targetId: userId || 'unknown',
    device,
    ipAddress: 'Local Browser',
    timestamp,
    metadata: { detail, source: 'ui' },
  }
  const logs = local.get<any[]>('audit_logs', []) || []
  logs.unshift(entry)
  local.set('audit_logs', logs.slice(0, 5000))
}

export const genId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2)

// WAT = UTC+1. All week/day calculations use WAT so they are consistent
// between the browser (system tz) and Vercel (UTC).
const WAT_OFFSET_MS = 1 * 60 * 60 * 1000

function nowWAT(date: Date = new Date()): Date {
  return new Date(date.getTime() + WAT_OFFSET_MS)
}

export function getWeekKey(date: Date = new Date()): string {
  const wat = nowWAT(date)
  const day = wat.getUTCDay()
  const diff = wat.getUTCDate() - day + (day === 0 ? -6 : 1)
  wat.setUTCDate(diff)
  const yyyy = wat.getUTCFullYear()
  const mm = String(wat.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(wat.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function fmtDate(iso: string | Date | undefined): string {
  if (!iso) return ''
  // Date-only keys (YYYY-MM-DD) are calendar dates — format in UTC so a browser
  // tz west of UTC doesn't render them as the previous day.
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
  }
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Date + time in WAT (Africa/Lagos), e.g. "1 Jul 2026, 14:32"
export function fmtDateTime(iso: string | Date | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16']
export function avatarColor(name: string = ''): string {
  let hash = 0
  for (let c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function initials(name: string = ''): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function isSubmissionOpen(submissionWindow?: {
  enabled: boolean;
  schedule: {
    startDay: string;
    startTime: string;
    endDay: string;
    endTime: string;
  };
  latePenalty: {
    enabled: boolean;
    pointsPerPeriod: number;
    periodHours: number;
  };
  timezone: string;
}): boolean {
  if (!submissionWindow) {
    // Fallback: Mon 08:00–Tue 16:00 WAT (UTC+1)
    const wat = nowWAT()
    const day = wat.getUTCDay()
    const hour = wat.getUTCHours()
    if (day === 1 && hour >= 8) return true
    if (day === 2 && hour < 16) return true
    return false
  }
  return getSubmissionWindowStatus(submissionWindow).isOpen
}

// Submission window utilities
const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
}

export interface SubmissionWindowStatus {
  isOpen: boolean;
  isClosed: boolean;
  isPastDeadline: boolean;
  deadline: Date | null;
  hoursLate: number;
  periodsLate: number;
  penalty: number;
  nextOpens: Date | null;
}

export function getSubmissionWindowStatus(
  submissionWindow?: {
    enabled: boolean;
    schedule: {
      startDay: string;
      startTime: string;
      endDay: string;
      endTime: string;
    };
    latePenalty: {
      enabled: boolean;
      pointsPerPeriod: number;
      periodHours: number;
    };
    timezone: string;
  }
): SubmissionWindowStatus {
  // Default to always open if not configured
  if (!submissionWindow || !submissionWindow.enabled) {
    return {
      isOpen: true,
      isClosed: false,
      isPastDeadline: false,
      deadline: null,
      hoursLate: 0,
      periodsLate: 0,
      penalty: 0,
      nextOpens: null
    }
  }

  const nowUtc = new Date()
  const now = nowWAT(nowUtc) // work entirely in WAT
  const { schedule, latePenalty } = submissionWindow

  // Calculate this week's deadline (all in WAT via UTC methods)
  const startDayNum = DAY_MAP[schedule.startDay.toLowerCase()]
  const endDayNum = DAY_MAP[schedule.endDay.toLowerCase()]

  // Get current week's Monday (WAT)
  const currentDay = now.getUTCDay()
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
  const monday = new Date(now)
  monday.setUTCDate(monday.getUTCDate() + mondayOffset)
  monday.setUTCHours(0, 0, 0, 0)

  // Calculate window start: set WAT time on WAT-shifted date, then subtract WAT offset → UTC
  const windowStart = new Date(monday)
  windowStart.setUTCDate(windowStart.getUTCDate() + (startDayNum - 1))
  const [startHour, startMin] = schedule.startTime.split(':').map(Number)
  windowStart.setUTCHours(startHour, startMin, 0, 0)
  const windowStartUtc = new Date(windowStart.getTime() - WAT_OFFSET_MS)

  // Calculate window end/deadline: same pattern
  const deadline = new Date(monday)
  deadline.setUTCDate(deadline.getUTCDate() + (endDayNum - 1))
  const [endHour, endMin] = schedule.endTime.split(':').map(Number)
  deadline.setUTCHours(endHour, endMin, 0, 0)
  const deadlineUtc = new Date(deadline.getTime() - WAT_OFFSET_MS)

  const isOpen = nowUtc >= windowStartUtc && nowUtc <= deadlineUtc
  const isPastDeadline = nowUtc > deadlineUtc
  const isClosed = nowUtc < windowStartUtc

  // Calculate late penalty
  let hoursLate = 0
  let periodsLate = 0
  let penalty = 0

  if (isPastDeadline && latePenalty.enabled) {
    const msLate = nowUtc.getTime() - deadlineUtc.getTime()
    hoursLate = msLate / (1000 * 60 * 60)
    // Flat one-time late penalty (no per-hours multiplier)
    periodsLate = 1
    penalty = latePenalty.pointsPerPeriod || 0
  }

  // Calculate next window opening
  let nextOpens: Date | null = null
  if (isClosed) {
    nextOpens = windowStartUtc
  } else if (isPastDeadline) {
    // Next week
    nextOpens = new Date(windowStartUtc)
    nextOpens.setUTCDate(nextOpens.getUTCDate() + 7)
  }

  return {
    isOpen,
    isClosed,
    isPastDeadline,
    deadline: deadlineUtc,
    hoursLate,
    periodsLate,
    penalty,
    nextOpens
  }
}

export function formatTimeUntilDeadline(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()

  if (diff <= 0) return 'Deadline passed'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export const DEFAULT_POINTS = {
  onTimeSubmission: 15, 
  mondayBonus: 10,
  earlyBonus: 5,
  approvedEntry: 2,
  approvedWithNote: 1,
  hoursBonus: 0.5,
  streakBonus: 20,
  perfectWeek: 25,
  rejectionDeduction: -10,
}

export const BADGES = [
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', desc: 'Submit before deadline consistently' },
  { id: 'consistent', name: 'Consistent', icon: '🔁', desc: 'Maintain a multi-week submission streak' },
  { id: 'zero_defect', name: 'Zero Defect', icon: '✅', desc: 'Multiple approved weeks with no rejections' },
  { id: 'top_performer', name: 'Top Performer', icon: '🌟', desc: 'Rank in top 5 on leaderboard' },
  { id: 'speed_logger', name: 'Speed Logger', icon: '⚡', desc: 'Submit within hours of week opening' },
  { id: 'perfect_week', name: 'Perfect Week', icon: '💯', desc: 'All entries approved, no rejections in a week' },
  { id: 'century_club', name: 'Century Club', icon: '💯', desc: 'Accumulate 100+ approved entries' },
  { id: 'mvp', name: 'MVP', icon: '🏆', desc: 'Highest points in a month' },
  { id: 'dedicated', name: 'Dedicated', icon: '💪', desc: 'Longest active streak' },
  { id: 'comeback', name: 'Comeback', icon: '🔄', desc: 'Return to submissions after a missed week' },
]

export function weekRange(weekKey: string | undefined): string {
  if (!weekKey) return ''
  // Parse the YYYY-MM-DD key as a fixed calendar date and format in UTC so the
  // range reads the same in every browser timezone (a tz west of UTC would
  // otherwise render Monday's UTC-midnight as the previous day — "Sunday").
  const [y, m, d] = weekKey.split('-').map(Number)
  const mon = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  const fri = new Date(mon)
  fri.setUTCDate(fri.getUTCDate() + 4)
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC' }
  return `${mon.toLocaleDateString('en-GB', { ...opts, day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-GB', { ...opts, day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function exportCSV(rows: any[], filename: string): void {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '').replace(/"/g, '""')
      return `"${v}"`
    }).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// PDF export using jsPDF
export async function exportPDF(rows: any[], columns: any[], title: string, filename: string): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text(title, 14, 15)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)
    autoTable(doc, {
      head: [columns.map(c => c.label)],
      body: rows.map(r => columns.map(c => r[c.key] ?? '')),
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    })
    doc.save(filename)
  } catch (e) {
    console.error('PDF export failed:', e)
    throw e
  }
}

// Session tracking
export function registerSession(userId: string): void {
  const sessions = local.get<any>('active_sessions', {}) || {}
  sessions[userId] = { userId, loginAt: new Date().toISOString(), lastSeen: new Date().toISOString() }
  local.set('active_sessions', sessions)
}

export function updateSessionHeartbeat(userId: string): void {
  const sessions = local.get<any>('active_sessions', {}) || {}
  if (sessions[userId]) {
    sessions[userId].lastSeen = new Date().toISOString()
    local.set('active_sessions', sessions)
  }
}

export function removeSession(userId: string): void {
  const sessions = local.get<any>('active_sessions', {}) || {}
  delete sessions[userId]
  local.set('active_sessions', sessions)
}

export function getActiveSessions(): any[] {
  const sessions = local.get<any>('active_sessions', {}) || {}
  const cutoff = Date.now() - 5 * 60 * 1000 // 5 min inactivity = offline
  return Object.values(sessions).filter((s: any) => new Date(s.lastSeen).getTime() > cutoff)
}

// Real Email Notification Sender (Updated to use Resend with React Email templates)
export async function sendEmailNotification(to: string, title: string, message: string, link?: string): Promise<void> {
  try {
    // Determine base URL depending on window / environment
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const fullLink = link ? (link.startsWith('http') ? link : `${baseUrl}${link}`) : undefined

    // Use the new template-based email API
    const res = await fetch('/api/email/send-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'notification',
        to,
        title,
        message,
        actionUrl: fullLink,
        actionText: 'View Details'
      })
    })

    const data = await res.json()
    if (!res.ok) {
      console.warn('Email dispatch failed:', data.message || data.error)
    } else {
      console.log('Email sent successfully via Resend')
    }
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}
