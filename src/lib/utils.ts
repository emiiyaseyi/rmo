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
  const logs = local.get<any[]>('audit_logs', []) || [];
  logs.unshift({ id: Date.now().toString(), action, detail, userId, userName, timestamp: new Date().toISOString() })
  local.set('audit_logs', logs.slice(0, 5000))
}

export const genId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2)

export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
}

export function fmtDate(iso: string | Date | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

export function isSubmissionOpen(): boolean {
  const now = new Date()
  const wat = new Date(now.getTime() + 60 * 60 * 1000)
  const day = wat.getUTCDay()
  const hour = wat.getUTCHours()
  if (day === 1 && hour >= 8) return true
  if (day === 2 && hour < 16) return true
  return false
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
  const mon = new Date(weekKey)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  return `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
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

// Real Email Notification Sender
export async function sendEmailNotification(to: string, title: string, message: string, link?: string): Promise<void> {
  let html = `<div style="font-family: sans-serif; padding: 20px;">
    <h2>${title}</h2>
    <p>${message}</p>`
  
  if (link) {
    // Determine base URL depending on window / environment
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const fullLink = link.startsWith('http') ? link : `${baseUrl}${link}`
    html += `<p><a href="${fullLink}" style="display:inline-block; padding: 10px 15px; background: #076C04; color: #fff; text-decoration: none; border-radius: 5px;">View Details</a></p>`
  }
  html += `</div>`

  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject: title, text: message, html })
    })
    const data = await res.json()
    if (!res.ok) console.warn('Email dispatch failed:', data.message || data.error)
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}
