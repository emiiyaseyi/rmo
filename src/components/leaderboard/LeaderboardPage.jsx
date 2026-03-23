import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { BADGES, genId } from '../../lib/utils'
import toast from 'react-hot-toast'

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const { staff, user, entries, hof, saveHof, rewards, saveRewards, redeems, saveRedeems, awardPoints } = useApp()
  const [tab, setTab] = useState('individual')
  const [showShop, setShowShop] = useState(false)
  const [showAddReward, setShowAddReward] = useState(false)
  const [rewardForm, setRewardForm] = useState({ name: '', desc: '', cost: '', icon: '🎁' })

  // Rankings
  const ranked = useMemo(() =>
    staff
      .filter(s => !s.suspended)
      .map(s => ({
        ...s,
        submissionRate: (() => {
          const myEntries = entries.filter(e => e.staffId === s.id)
          const weeks = [...new Set(myEntries.map(e => e.weekKey))]
          const submitted = weeks.filter(w => myEntries.some(e => e.weekKey === w && ['submitted', 'approved', 'resubmitted'].includes(e.status)))
          return weeks.length > 0 ? Math.round((submitted.length / weeks.length) * 100) : 0
        })()
      }))
      .sort((a, b) => (b.points || 0) - (a.points || 0)),
    [staff, entries]
  )

  const myRank = ranked.findIndex(s => s.id === user?.id) + 1

  // Department leaderboard
  const deptRanked = useMemo(() => {
    const depts = {}
    staff.filter(s => !s.suspended && s.department).forEach(s => {
      if (!depts[s.department]) depts[s.department] = { dept: s.department, members: 0, totalPts: 0, totalRate: 0 }
      depts[s.department].members++
      depts[s.department].totalPts += s.points || 0
      const myEntries = entries.filter(e => e.staffId === s.id)
      const weeks = [...new Set(myEntries.map(e => e.weekKey))]
      const submitted = weeks.filter(w => myEntries.some(e => e.weekKey === w && ['submitted', 'approved', 'resubmitted'].includes(e.status)))
      depts[s.department].totalRate += weeks.length > 0 ? (submitted.length / weeks.length) * 100 : 0
    })
    return Object.values(depts).map(d => ({
      ...d,
      avgPts: d.members > 0 ? Math.round(d.totalPts / d.members) : 0,
      avgRate: d.members > 0 ? Math.round(d.totalRate / d.members) : 0,
    })).sort((a, b) => b.avgPts - a.avgPts)
  }, [staff, entries])

  function saveHofNow() {
    const top3 = ranked.slice(0, 3).map((s, i) => ({ ...s, rank: i + 1, savedAt: new Date().toISOString() }))
    saveHof(top3)
    toast.success('Hall of Fame updated!')
  }

  function addReward() {
    if (!rewardForm.name || !rewardForm.cost) { toast.error('Name and cost required'); return }
    const r = { ...rewardForm, id: genId(), cost: parseInt(rewardForm.cost), active: true, createdAt: new Date().toISOString() }
    saveRewards([...rewards, r])
    setRewardForm({ name: '', desc: '', cost: '', icon: '🎁' })
    setShowAddReward(false)
    toast.success('Reward added')
  }

  function redeemReward(reward) {
    const myPts = user?.points || 0
    if (myPts < reward.cost) { toast.error('Not enough points'); return }
    if (!window.confirm(`Redeem "${reward.name}" for ${reward.cost} pts?`)) return
    const redeem = { id: genId(), staffId: user.id, staffName: user.name, rewardId: reward.id, rewardName: reward.name, cost: reward.cost, createdAt: new Date().toISOString(), status: 'pending' }
    saveRedeems([...redeems, redeem])
    awardPoints(user.id, -reward.cost, 'Reward redemption')
    toast.success('🎁 Redemption request sent to admin!')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      {/* My rank card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
        borderRadius: 14, padding: 20, color: 'white',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ fontSize: 40 }}>{myRank <= 3 ? MEDAL[myRank - 1] : `#${myRank}`}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Your Rank</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>#{myRank} of {ranked.length}</div>
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

      {/* Tabs */}
      <div className="tabs">
        {['individual', 'department', 'badges', 'hof'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'individual' ? '👤 Individual' : t === 'department' ? '🏢 Department' : t === 'badges' ? '🏅 Badges' : '🏛️ Hall of Fame'}
          </div>
        ))}
      </div>

      {/* Individual */}
      {tab === 'individual' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Points</th>
                  <th>Streak</th>
                  <th>Submit Rate</th>
                  <th>Badges</th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 30).map((s, i) => (
                  <tr key={s.id} style={{ background: s.id === user?.id ? 'var(--accent-subtle)' : '' }}>
                    <td style={{ fontWeight: 700, fontSize: 18 }}>
                      {i < 3 ? MEDAL[i] : `#${i + 1}`}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ background: `hsl(${(s.name?.charCodeAt(0) || 0) * 20 % 360}, 60%, 45%)`, fontSize: 10 }}>
                          {s.name?.[0]}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.name}{s.id === user?.id ? ' (You)' : ''}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>{s.department || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--mono)' }}>{(s.points || 0).toLocaleString()}</td>
                    <td>
                      {s.streak > 0 ? <span className="badge badge-yellow">🔥 {s.streak}w</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ width: 60, display: 'inline-block' }}>
                          <div className="progress-bar" style={{ width: `${s.submissionRate}%`, background: s.submissionRate >= 80 ? 'var(--success)' : 'var(--warning)' }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{s.submissionRate}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {(s.badges || []).slice(0, 4).map(b => {
                          const badge = BADGES.find(x => x.id === b)
                          return badge ? <span key={b} title={badge.name} style={{ fontSize: 16 }}>{badge.icon}</span> : null
                        })}
                        {(s.badges || []).length > 4 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>+{s.badges.length - 4}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pinned user rank if below top 30 */}
          {myRank > 30 && (
            <div style={{
              padding: '12px 14px', borderTop: '2px dashed var(--accent)',
              background: 'var(--accent-subtle)', display: 'flex', gap: 12, alignItems: 'center'
            }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>#{myRank}</span>
              <div className="avatar avatar-sm" style={{ background: 'var(--accent)', fontSize: 10 }}>{user?.name?.[0]}</div>
              <span style={{ fontWeight: 600 }}>{user?.name} (You)</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--gold)' }}>{user?.points || 0} pts</span>
            </div>
          )}
        </div>
      )}

      {/* Department */}
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

      {/* Badges */}
      {tab === 'badges' && (
        <div className="grid-3">
          {BADGES.map(badge => {
            const earned = (user?.badges || []).includes(badge.id)
            return (
              <div key={badge.id} className="card" style={{ textAlign: 'center', opacity: earned ? 1 : 0.4, borderColor: earned ? 'var(--accent)' : 'var(--border)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{badge.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{badge.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{badge.desc}</div>
                {earned && <span className="badge badge-green" style={{ marginTop: 10 }}>Earned ✓</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Hall of Fame */}
      {tab === 'hof' && (
        hof.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">🏛️</div>
            <div className="empty-state-title">Hall of Fame is empty</div>
            <div className="empty-state-desc">Admin saves the top 3 to preserve the leaderboard snapshot</div>
          </div>
        ) : (
          <div className="grid-3">
            {hof.map(s => (
              <div key={s.id} className="hof-card">
                <div style={{ fontSize: 40, marginBottom: 8 }}>{MEDAL[s.rank - 1]}</div>
                <div className="avatar avatar-lg" style={{ margin: '0 auto 12px', background: `hsl(${(s.name?.charCodeAt(0) || 0) * 20 % 360}, 60%, 45%)`, fontSize: 22 }}>
                  {s.name?.[0]}
                </div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{s.name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>{s.department}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{(s.points || 0).toLocaleString()} pts</div>
                {s.savedAt && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Saved {new Date(s.savedAt).toLocaleDateString()}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {/* Points Shop modal */}
      {showShop && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowShop(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">🛍️ Points Shop</span>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowShop(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>Your balance: <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{user?.points || 0} pts</span></div>
                {user?.role === 'admin' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReward(!showAddReward)}>+ Add Reward</button>
                )}
              </div>

              {showAddReward && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Reward Name</label>
                      <input className="form-input" value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Extra Day Off" />
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

              {rewards.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎁</div>
                  <div className="empty-state-title">No rewards yet</div>
                  <div className="empty-state-desc">Admin can add rewards for staff to redeem</div>
                </div>
              ) : (
                <div className="grid-3">
                  {rewards.filter(r => r.active).map(r => (
                    <div key={r.id} className="reward-card">
                      <div style={{ fontSize: 36, marginBottom: 8 }}>{r.icon}</div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>{r.desc}</div>
                      <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>{r.cost} pts</div>
                      <button
                        className="btn btn-primary btn-sm w-full"
                        disabled={(user?.points || 0) < r.cost}
                        onClick={() => redeemReward(r)}
                      >
                        {(user?.points || 0) >= r.cost ? 'Redeem' : 'Not enough pts'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {redeems.filter(r => r.staffId === user?.id).length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 10, marginTop: 8 }}>My Redemptions</div>
                  {redeems.filter(r => r.staffId === user?.id).map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 6 }}>
                      <span>{r.rewardName}</span>
                      <span className={`badge badge-${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
