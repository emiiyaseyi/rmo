import { getSupabase } from './supabase'

const PREFIX = 'dsn_'

export const local = {
  get: (key, fallback = null) => {
    try {
      const v = localStorage.getItem(PREFIX + key)
      return v ? JSON.parse(v) : fallback
    } catch { return fallback }
  },
  set: (key, val) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)) } catch {}
  },
  remove: (key) => localStorage.removeItem(PREFIX + key),
}

export function logAudit(action, detail, userId, userName) {
  const logs = local.get('audit_logs', [])
  logs.unshift({ id: Date.now().toString(), action, detail, userId, userName, timestamp: new Date().toISOString() })
  local.set('audit_logs', logs.slice(0, 5000))
}

export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

export function getWeekKey(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
}

export function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#84CC16']
export function avatarColor(name = '') {
  let hash = 0
  for (let c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function initials(name = '') {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function isSubmissionOpen() {
  const now = new Date()
  const wat = new Date(now.getTime() + 60 * 60 * 1000)
  const day = wat.getUTCDay()
  const hour = wat.getUTCHours()
  if (day === 1 && hour >= 8) return true
  if (day === 2 && hour < 16) return true
  return false
}

export const DEFAULT_POINTS = {
  submit_ontime: 10, submit_early: 15, approved: 5,
  streak_week: 8, complete_45h: 12, first_submit: 20,
}

export const BADGES = [
  { id: 'first_blood', name: 'First Submit', icon: '🎯', desc: 'Submitted your first timesheet' },
  { id: 'streak_3', name: '3-Week Streak', icon: '🔥', desc: 'Submitted 3 weeks in a row' },
  { id: 'streak_5', name: '5-Week Streak', icon: '⚡', desc: 'Submitted 5 weeks in a row' },
  { id: 'streak_10', name: 'Consistent Pro', icon: '💎', desc: '10-week submission streak' },
  { id: 'full_house', name: 'Full House', icon: '🏠', desc: 'Hit 45h cap in a week' },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', desc: 'Submitted before Monday noon' },
  { id: 'perfect_week', name: 'Perfect Week', icon: '⭐', desc: 'All entries approved first try' },
  { id: 'top_3', name: 'Podium Finish', icon: '🏆', desc: 'Ranked in top 3 on leaderboard' },
  { id: 'centurion', name: 'Centurion', icon: '💯', desc: 'Earned 100+ total points' },
]

export function weekRange(weekKey) {
  if (!weekKey) return ''
  const mon = new Date(weekKey)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  return `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function exportCSV(rows, filename) {
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
export async function exportPDF(rows, columns, title, filename) {
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

// Supabase real-time sync helper
export async function syncToSupabase(table, data) {
  const sb = getSupabase()
  if (!sb) return false
  try {
    const { error } = await sb.from(table).upsert(data, { onConflict: 'id' })
    if (error) throw error
    return true
  } catch (e) {
    console.warn('Supabase sync failed:', e.message)
    return false
  }
}

export async function fetchFromSupabase(table) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb.from(table).select('*')
    if (error) throw error
    return data
  } catch (e) {
    console.warn('Supabase fetch failed:', e.message)
    return null
  }
}

// Session tracking
export function registerSession(userId) {
  const sessions = local.get('active_sessions', {})
  sessions[userId] = { userId, loginAt: new Date().toISOString(), lastSeen: new Date().toISOString() }
  local.set('active_sessions', sessions)
}

export function updateSessionHeartbeat(userId) {
  const sessions = local.get('active_sessions', {})
  if (sessions[userId]) {
    sessions[userId].lastSeen = new Date().toISOString()
    local.set('active_sessions', sessions)
  }
}

export function removeSession(userId) {
  const sessions = local.get('active_sessions', {})
  delete sessions[userId]
  local.set('active_sessions', sessions)
}

export function getActiveSessions() {
  const sessions = local.get('active_sessions', {})
  const cutoff = Date.now() - 5 * 60 * 1000 // 5 min inactivity = offline
  return Object.values(sessions).filter(s => new Date(s.lastSeen).getTime() > cutoff)
}
