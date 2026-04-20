'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { BADGES, genId, exportCSV, exportPDF, avatarColor } from '../../lib/utils'
import { Staff, HofEntry, Reward, Redemption } from '../../types'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

const MEDAL = ['🥇', '🥈', '🥉']

interface RankedStaff extends Staff {
  submissionRate: number;
}

interface DeptRank {
  dept: string;
  members: number;
  totalPts: number;
  totalRate: number;
  avgPts: number;
  avgRate: number;
}

export default function LeaderboardPage() {
  const { staff, user, entries, hof, saveHof, rewards, saveRewards, redeems, saveRedeems, awardPoints, streakRecoveries, saveStreakRecoveries, saveStaff, notify } = useApp()
  const [tab, setTab] = useState('individual')
  const [showShop, setShowShop] = useState(false)
  const [showAddReward, setShowAddReward] = useState(false)
  const [rewardForm, setRewardForm] = useState({ name: '', desc: '', cost: '', icon: '🎁' })
  const [recoveryForm, setRecoveryForm] = useState({ weekId: '', reason: '' })
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, action: () => void, message: string, title?: string}>({isOpen: false, action: () => {}, message: ''})

  // Rankings
  const ranked: RankedStaff[] = useMemo(() =>
    staff
      .filter(s => !s.suspended)
      .map(s => ({
        ...s,
        submissionRate: (() => {
          const myEntries = entries.filter(e => e.staffId === s.id)
          const weeks = Array.from(new Set(myEntries.map(e => e.weekKey)))
          const submitted = weeks.filter(w => myEntries.some(e => e.weekKey === w && ['submitted', 'approved', 'resubmitted'].includes(e.status)))
          return weeks.length > 0 ? Math.round((submitted.length / weeks.length) * 100) : 0
        })()
      }))
      .filter(s => {
        const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
        const matchDept = !deptFilter || s.department === deptFilter
        return matchSearch && matchDept
      })
      .sort((a, b) => (b.points || 0) - (a.points || 0)),
    [staff, entries, search, deptFilter]
  )

  const myRank = ranked.findIndex(s => s.id === user?.id) + 1

  // Department leaderboard
  const deptRanked: DeptRank[] = useMemo(() => {
    const depts: Record<string, DeptRank> = {}
    staff.filter(s => !s.suspended && s.department).forEach(s => {
      const deptName = s.department || 'Other'
      if (!depts[deptName]) {
        depts[deptName] = { dept: deptName, members: 0, totalPts: 0, totalRate: 0, avgPts: 0, avgRate: 0 }
      }
      const d = depts[deptName]
      d.members++
      d.totalPts += s.points || 0
      const myEntries = entries.filter(e => e.staffId === s.id)
      const weeks = Array.from(new Set(myEntries.map(e => e.weekKey)))
      const submitted = weeks.filter(w => myEntries.some(e => e.weekKey === w && ['submitted', 'approved', 'resubmitted'].includes(e.status)))
      d.totalRate += weeks.length > 0 ? (submitted.length / weeks.length) * 100 : 0
    })
    return Object.values(depts).map(d => ({
      ...d,
      avgPts: d.members > 0 ? Math.round(d.totalPts / d.members) : 0,
      avgRate: d.members > 0 ? Math.round(d.totalRate / d.members) : 0,
    })).sort((a, b) => b.avgPts - a.avgPts)
  }, [staff, entries])

  function saveHofNow() {
    const top3: HofEntry[] = ranked.slice(0, 3).map((s, i) => ({ ...s, rank: i + 1, savedAt: new Date().toISOString() }))
    saveHof(top3)
    toast.success('Hall of Fame updated!')
  }

  function addReward() {
    if (!rewardForm.name || !rewardForm.cost) { toast.error('Name and cost required'); return }
    const r: Reward = {
      ...rewardForm,
      id: genId(),
      cost: parseInt(rewardForm.cost),
      active: true,
      stock: 10, // Default stock
      isEnabled: true,
      createdAt: new Date().toISOString()
    }
    saveRewards([...rewards, r])
    setRewardForm({ name: '', desc: '', cost: '', icon: '🎁' })
    setShowAddReward(false)
    toast.success('Reward added')
  }

  function redeemReward(reward: Reward) {
    if (!user) return
    if (reward.stock <= 0) { toast.error('Item out of stock'); return }
    const myPts = user.points || 0
    if (myPts < reward.cost) { toast.error('Not enough points'); return }

    setConfirmAction({
      isOpen: true,
      action: () => {
        const redeem: Redemption = {
      id: genId(),
      staffId: user.id,
      staffName: user.name,
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    // Deduct stock
    const updatedRewards = rewards.map(r => r.id === reward.id ? { ...r, stock: r.stock - 1 } : r)
    saveRewards(updatedRewards)

        saveRedeems([...redeems, redeem])
        awardPoints(user.id, -reward.cost, `Redeemed ${reward.name}`)
        toast.success('🎁 Redemption request sent to admin!')
      },
      message: `Redeem "${reward.name}" for ${reward.cost} pts?`,
      title: 'Confirm Redemption'
    })
  }

  function handleRecoveryRequest() {
    if (!recoveryForm.weekId || !recoveryForm.reason) { toast.error('Week and reason required'); return }
    const req = {
      id: genId(),
      staffId: user!.id,
      staffName: user!.name,
      weekId: recoveryForm.weekId,
      reason: recoveryForm.reason,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    }
    saveStreakRecoveries([...streakRecoveries, req])
    setRecoveryForm({ weekId: '', reason: '' })
    toast.success('Recovery request submitted')
  }

  function resolveRecovery(reqId: string, status: 'approved' | 'rejected') {
    const req = streakRecoveries.find(r => r.id === reqId)
    if (!req) return
    
    const updated = streakRecoveries.map(r => r.id === reqId ? { ...r, status, reviewedBy: user?.name, reviewedAt: new Date().toISOString() } : r)
    saveStreakRecoveries(updated)
    notify(req.staffId, `Your streak recovery request was ${status}.`, status === 'approved' ? 'streak_recovery_approved' : 'streak_recovery_declined', `Streak Recovery ${status === 'approved' ? 'Approved' : 'Declined'}`, reqId, 'message')
    
    if (status === 'approved') {
      const sIdx = staff.findIndex(s => s.id === req.staffId)
      if (sIdx > -1) {
        const updatedStaff = [...staff]
        updatedStaff[sIdx] = { ...updatedStaff[sIdx], streak: (updatedStaff[sIdx].streak || 0) + 1 }
        saveStaff(updatedStaff)
        awardPoints(req.staffId, 5, 'Streak Recovery Bonus', req.weekId)
      }
    }
    toast.success(`Request ${status}`)
  }

  function fulfillRedeem(id: string) {
    const updated = redeems.map(r => r.id === id ? { ...r, status: 'fulfilled' as const, fulfilledAt: new Date().toISOString() } : r)
    saveRedeems(updated)
    const r = redeems.find(x => x.id === id)
    if (r) notify(r.staffId, `Your redemption for ${r.rewardName} has been fulfilled!`, 'redemption_fulfilled', 'Reward Fulfilled', id, 'message')
    toast.success('Reward fulfilled!')
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    const data = ranked.map((s, i) => ({
      Rank: i + 1,
      Name: s.name,
      Department: s.department || '—',
      Points: s.points || 0,
      SubmissionRate: s.submissionRate + '%',
      Streak: s.streak || 0
    }))
    
    if (format === 'csv') {
      exportCSV(data, `leaderboard_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Exported CSV')
    } else {
      const cols = [
        { key: 'Rank', label: '#' },
        { key: 'Name', label: 'Name' },
        { key: 'Department', label: 'Dept' },
        { key: 'Points', label: 'Pts' },
        { key: 'SubmissionRate', label: 'Rate' },
        { key: 'Streak', label: '🔥' }
      ]
      exportPDF(data, cols, 'Staff Leaderboard', `leaderboard_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('Exported PDF')
    }
  }

  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ... rest of the UI ... */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏆 Leaderboard</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Rankings, badges & rewards</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowShop(!showShop)}>
            🛍️ Points Shop
          </button>
          {user?.role === 'admin' && (
            <button className="btn btn-secondary btn-sm" onClick={saveHofNow}>Save Hall of Fame</button>
          )}
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
        borderRadius: 14, padding: 20, color: 'white',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ fontSize: 40 }}>{myRank > 0 && myRank <= 3 ? MEDAL[myRank - 1] : `#${myRank || '-'}`}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Your Rank</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>#{myRank || '-'} of {ranked.length}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{user?.points || 0} points · {user?.streak || 0} week streak</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Badges</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 120 }}>
            {(user?.badges || []).map(b => {
              const badge = BADGES.find(x => x.id === b)
              return badge ? <span key={b} style={{ fontSize: 20 }} title={badge.name}>{badge.icon}</span> : null
            })}
            {(user?.badges || []).length === 0 && <span style={{ opacity: 0.6, fontSize: 12 }}>No badges yet</span>}
          </div>
        </div>
      </div>

      <div className="tabs">
        {['individual', 'department', 'badges', 'hof', 'recovery'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'individual' ? '👤 Individual' : t === 'department' ? '🏢 Department' : t === 'badges' ? '🏅 Badges' : t === 'hof' ? '🏛️ Hall of Fame' : '🔄 Recovery'}
          </div>
        ))}
      </div>

      {tab === 'individual' && (
        <div className="flex flex-col gap-4">
          <div className="card flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-3 flex-1 min-w-[300px]">
              <input 
                className="form-input flex-1" 
                placeholder="Search staff..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              <select className="form-select w-48" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>💾 CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>📕 PDF</button>
            </div>
          </div>
          {/* Pinned My Rank Card (if not in top 25) */}
          {(myRank > 25 || myRank === 0) && (
            <div className="card border-accent bg-accent-subtle relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold opacity-50">#{myRank || '?'}</div>
                <div className="flex-1">
                  <div className="font-bold text-1">{user?.name} (You)</div>
                  <div className="text-xs text-3">{user?.points || 0} points · {user?.streak || 0}w streak</div>
                </div>
                {myRank > 25 && (
                  <div className="text-right">
                    <div className="text-xs text-4">To enter Top 25</div>
                    <div className="font-bold text-accent">+{ (ranked[24]?.points || 0) - (user?.points || 0) + 1 } pts</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Points</th>
                    <th>Performance</th>
                    <th>Streak</th>
                    <th>Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 25).map((s, i) => {
                    const isMe = s.id === user?.id
                    const relWidth = Math.max(5, Math.round(((s.points || 0) / (ranked[0]?.points || 1)) * 100))
                    return (
                      <tr key={s.id} className={isMe ? 'bg-accent-subtle' : ''}>
                        <td className="font-bold text-lg">
                          {i < 3 ? MEDAL[i] : (i < 25 ? `🏅 #${i + 1}` : `#${i + 1}`)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                             <div className="avatar avatar-xs" style={{ background: `hsl(${(s.name?.charCodeAt(0) || 0) * 40 % 360}, 60%, 45%)` }}>
                                {s.name?.[0]}
                             </div>
                            <span className="font-bold">{s.name}{isMe ? ' (You)' : ''}</span>
                          </div>
                          <div className="text-4 text-xs">{s.department}</div>
                        </td>
                        <td className="font-bold text-accent">{(s.points || 0).toLocaleString()}</td>
                        <td style={{ minWidth: 140 }}>
                          <div className="flex flex-col gap-1">
                            <div className="progress h-1.5 w-full bg-border rounded-full overflow-hidden">
                                <div className="progress-bar h-full bg-accent" style={{ width: `${relWidth}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-4">
                                <span>{s.submissionRate}% rate</span>
                                <span>{relWidth}% of top</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {s.streak ? <span className="badge badge-yellow">🔥 {s.streak}</span> : <span className="text-4">—</span>}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {(s.badges || []).slice(0, 3).map(b => {
                              const badge = BADGES.find(x => x.id === b)
                              return badge ? <span key={b} title={badge.name}>{badge.icon}</span> : null
                            })}
                            {(s.badges || []).length > 3 && <span className="text-4 text-xs">+{s.badges!.length - 3}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'department' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Department</th>
                  <th>Members</th>
                  <th>Avg Points</th>
                  <th>Avg Submit Rate</th>
                </tr>
              </thead>
              <tbody>
                {deptRanked.map((d, i) => (
                  <tr key={d.dept}>
                    <td style={{ fontWeight: 700, fontSize: 18 }}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</td>
                    <td style={{ fontWeight: 600 }}>{d.dept}</td>
                    <td>{d.members}</td>
                    <td style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--mono)' }}>{d.avgPts}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ width: 80 }}>
                          <div className="progress-bar" style={{ width: `${d.avgRate}%`, background: d.avgRate >= 80 ? 'var(--success)' : 'var(--warning)' }} />
                        </div>
                        <span>{d.avgRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BADGES.map(badge => {
            const earned = (user?.badges || []).includes(badge.id)
            return (
              <div key={badge.id} className={`card flex items-center gap-4 ${earned ? 'border-accent bg-accent-subtle' : 'opacity-50 grayscale'}`}>
                <div className="text-4xl">{badge.icon}</div>
                <div className="flex-1">
                  <div className="font-bold">{badge.name}</div>
                  <div className="text-xs text-3">{badge.desc}</div>
                  {!earned && <div className="text-[10px] text-accent mt-1 uppercase font-bold tracking-wider">Earn: {badge.id.replace(/_/g, ' ')}...</div>}
                </div>
                {earned && <div className="text-accent">✓</div>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'hof' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hof.length === 0 ? (
            <div className="empty-state card col-span-full">
              <div className="empty-state-icon">🏛️</div>
              <div className="empty-state-title">Hall of Fame is empty</div>
              <p className="text-4 text-xs mt-2">Admins can save a snapshot of the current Top 3.</p>
            </div>
          ) : (
            hof.map((s, i) => (
              <div key={s.id} className="card text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 font-bold text-4xl">#{s.rank}</div>
                <div className="text-5xl mb-4">{MEDAL[s.rank - 1]}</div>
                <div className="font-bold text-lg">{s.name}</div>
                <div className="text-xs text-4 mb-3">{s.department}</div>
                <div className="text-2xl font-bold text-accent">{(s.points || 0).toLocaleString()} <span className="text-xs uppercase opacity-60">pts</span></div>
                {s.savedAt && <div className="text-[10px] text-4 mt-4 italic">Snapshot: {new Date(s.savedAt).toLocaleDateString()}</div>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'recovery' && (
        <div className="flex flex-col gap-6">
          {user?.role !== 'admin' && (
            <div className="card w-full" style={{ maxWidth: 700, margin: '0 auto', border: 'none', background: 'linear-gradient(145deg, var(--bg-card), var(--bg-hover))', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ width: 64, height: 64, borderRadius: '20px', background: 'var(--warning-bg)', border: '1px solid rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0, boxShadow: '0 8px 16px rgba(234, 179, 8, 0.15)' }}>
                  🔥
                </div>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Request Streak Recovery</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                    Missed a timesheet submission? Request a recovery to keep your streak alive.<br/>
                    <strong style={{ color: 'var(--warning)' }}>Limit: Once per month.</strong>
                  </p>
                </div>
              </div>
              
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '24px 28px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div className="grid-2" style={{ marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Week ID</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 18 }}>📅</span>
                      <input 
                        className="form-input" 
                        value={recoveryForm.weekId} 
                        onChange={e => setRecoveryForm({ ...recoveryForm, weekId: e.target.value })} 
                        placeholder="YYYY-WXX" 
                        style={{ paddingLeft: 46, height: 48, fontSize: 15, fontWeight: 600, borderRadius: 12 }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Streak</label>
                    <div style={{ height: 48, padding: '0 20px', background: 'var(--bg-elevated)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-1)', fontWeight: 700, fontSize: 15, border: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--warning)' }}>🔥</span> {user?.streak || 0} {user?.streak === 1 ? 'Week' : 'Weeks'}
                    </div>
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Reason for Request</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: 16, color: 'var(--text-3)', fontSize: 18 }}>✍️</span>
                    <textarea 
                      className="form-textarea" 
                      value={recoveryForm.reason} 
                      onChange={e => setRecoveryForm({ ...recoveryForm, reason: e.target.value })} 
                      placeholder="Please concisely explain why you missed your submission..." 
                      style={{ paddingLeft: 46, minHeight: 120, paddingTop: 16, fontSize: 14, borderRadius: 12 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex' }}>
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={handleRecoveryRequest}
                    disabled={!recoveryForm.weekId || !recoveryForm.reason}
                    style={{ height: 52, fontSize: 16, borderRadius: 12, boxShadow: '0 4px 16px rgba(7, 108, 4, 0.25)' }}
                  >
                    <span style={{ marginRight: 8, fontSize: 18 }}>✨</span> Submit Recovery Request
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card w-full mx-auto" style={{ maxWidth: 700, padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📜</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{user?.role === 'admin' ? 'All Recovery Requests' : 'Your Recovery Requests'}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Week</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {user?.role === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(streakRecoveries || [])
                    .filter(r => user?.role === 'admin' || r.staffId === user?.id)
                    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
                    .map(r => (
                      <tr key={r.id}>
                        <td>{r.staffName}</td>
                        <td className="font-mono">{r.weekId}</td>
                        <td className="max-w-xs truncate" title={r.reason}>{r.reason}</td>
                        <td>
                          <span className={`badge ${r.status === 'approved' ? 'badge-green' : r.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        {user?.role === 'admin' && r.status === 'pending' && (
                          <td className="flex gap-2">
                            <button className="btn btn-xs btn-green" onClick={() => resolveRecovery(r.id, 'approved')}>Approve</button>
                            <button className="btn btn-xs btn-red" onClick={() => resolveRecovery(r.id, 'rejected')}>Reject</button>
                          </td>
                        )}
                        {user?.role === 'admin' && r.status !== 'pending' && <td className="text-4 text-xs">Reviewed by {r.reviewedBy}</td>}
                      </tr>
                  ))}
                  {(streakRecoveries || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-4">No requests found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showShop && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowShop(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">🛍️ Points Shop</span>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowShop(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Your balance: <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{user?.points || 0} pts</span></div>
                {user?.role === 'admin' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReward(!showAddReward)}>+ Add Reward</button>
                )}
              </div>

              {showAddReward && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Reward Name</label>
                      <input className="form-input" value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Icon</label>
                      <input className="form-input" value={rewardForm.icon} onChange={e => setRewardForm(f => ({ ...f, icon: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={rewardForm.desc} onChange={e => setRewardForm(f => ({ ...f, desc: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost (points)</label>
                    <input className="form-input" type="number" value={rewardForm.cost} onChange={e => setRewardForm(f => ({ ...f, cost: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={addReward}>Add Reward</button>
                </div>
              )}

              <div className="grid-3 mb-8">
                {rewards.filter(r => r.active).map(r => (
                  <div key={r.id} className={`card text-center ${!r.isEnabled ? 'opacity-40 grayscale' : ''}`}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>{r.icon}</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{r.desc}</div>
                    <div className="flex justify-between items-center mb-3 px-4">
                      <span className="text-xs text-4">Stock: {r.stock}</span>
                      <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{r.cost} pts</span>
                    </div>
                    <button
                      className="btn btn-primary btn-sm w-full"
                      disabled={(user?.points || 0) < r.cost || r.stock <= 0 || !r.isEnabled}
                      onClick={() => redeemReward(r)}
                    >
                      {r.stock <= 0 ? 'Out of Stock' : (user?.points || 0) >= r.cost ? 'Redeem' : 'Not enough points'}
                    </button>
                    {user?.role === 'admin' && (
                      <div className="mt-3 flex gap-2">
                        <button className="btn btn-xs btn-secondary flex-1" onClick={() => saveRewards(rewards.map(x => x.id === r.id ? { ...x, stock: x.stock + 5 } : x))}>+5 Stock</button>
                        <button className="btn btn-xs btn-secondary" onClick={() => saveRewards(rewards.map(x => x.id === r.id ? { ...x, isEnabled: !x.isEnabled } : x))}>{r.isEnabled ? 'Disable' : 'Enable'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {user?.role === 'admin' && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="font-bold mb-4">Pending Fullfilment</h3>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Staff</th>
                            <th>Reward</th>
                            <th>Cost</th>
                            <th>Date</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {redeems.filter(r => r.status === 'pending').map(r => (
                            <tr key={r.id}>
                              <td>{r.staffName}</td>
                              <td>{r.rewardName}</td>
                              <td className="font-bold text-accent">{r.cost}</td>
                              <td className="text-xs text-4">{new Date(r.createdAt).toLocaleDateString()}</td>
                              <td>
                                <button className="btn btn-xs btn-accent" onClick={() => fulfillRedeem(r.id)}>Fulfill</button>
                              </td>
                            </tr>
                          ))}
                          {redeems.filter(r => r.status === 'pending').length === 0 && <tr><td colSpan={5} className="text-center py-6 text-4">No pending redemptions</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        onConfirm={confirmAction.action}
        onCancel={() => setConfirmAction({isOpen: false, action: () => {}, message: ''})}
      />
    </div>
  )
}
