import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, initials, avatarColor, timeAgo } from '../../lib/utils'

const CHANNELS = [
  { id: 'all_staff', name: 'All Staff', icon: '📢', type: 'group' },
  { id: 'admin_team', name: 'Admin Team', icon: '⚙️', type: 'group', adminOnly: true },
]

export default function MessagesPage() {
  const { user, staff, messages, sendMessage, saveMessages } = useApp()
  const [selected, setSelected] = useState('all_staff')
  const [text, setText] = useState('')
  const messagesEndRef = useRef(null)

  const channels = CHANNELS.filter(c => !c.adminOnly || user?.role === 'admin' || user?.role === 'owner')

  // DM threads
  const dmContacts = useMemo(() => {
    const contactIds = new Set()
    messages.forEach(m => {
      if (m.type === 'dm') {
        if (m.senderId === user?.id) contactIds.add(m.recipientId)
        if (m.recipientId === user?.id) contactIds.add(m.senderId)
      }
    })
    return staff.filter(s => s.id !== user?.id && (contactIds.has(s.id) || s.role === 'admin' || s.role === 'owner'))
  }, [messages, staff, user])

  const selectedMessages = useMemo(() => {
    if (selected.startsWith('dm_')) {
      const otherId = selected.replace('dm_', '')
      return messages
        .filter(m => m.type === 'dm' && ((m.senderId === user?.id && m.recipientId === otherId) || (m.recipientId === user?.id && m.senderId === otherId)))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    } else {
      return messages
        .filter(m => m.channelId === selected)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    }
  }, [messages, selected, user])

  const unreadCount = (thread) => {
    if (thread.startsWith('dm_')) {
      const otherId = thread.replace('dm_', '')
      return messages.filter(m => m.type === 'dm' && m.senderId === otherId && m.recipientId === user?.id && !(m.read || []).includes(user?.id)).length
    }
    return messages.filter(m => m.channelId === thread && m.senderId !== user?.id && !(m.read || []).includes(user?.id)).length
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Mark as read
    const updated = messages.map(m => {
      const inThread = selected.startsWith('dm_')
        ? m.type === 'dm' && m.recipientId === user?.id && m.senderId === selected.replace('dm_', '')
        : m.channelId === selected && m.senderId !== user?.id
      if (inThread && !(m.read || []).includes(user?.id)) {
        return { ...m, read: [...(m.read || []), user?.id] }
      }
      return m
    })
    saveMessages(updated)
  }, [selected, messages.length])

  function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    const isDm = selected.startsWith('dm_')
    sendMessage({
      id: genId(),
      senderId: user?.id,
      senderName: user?.name,
      text: text.trim(),
      type: isDm ? 'dm' : 'channel',
      channelId: isDm ? null : selected,
      recipientId: isDm ? selected.replace('dm_', '') : null,
      read: [user?.id],
    })
    setText('')
  }

  const selectedLabel = selected.startsWith('dm_')
    ? staff.find(s => s.id === selected.replace('dm_', ''))?.name
    : channels.find(c => c.id === selected)?.name

  // Staff to DM
  const canDM = staff.filter(s => s.id !== user?.id)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--topbar-h) - 80px)', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Sidebar */}
      <div style={{
        width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
          💬 Messages
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {/* Channels */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' }}>Channels</div>
          {channels.map(c => {
            const count = unreadCount(c.id)
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                  background: selected === c.id ? 'var(--accent-subtle)' : 'transparent',
                  color: selected === c.id ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 13, marginBottom: 2
                }}
              >
                <span>{c.icon}</span>
                <span style={{ flex: 1 }}>#{c.name}</span>
                {count > 0 && <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99 }}>{count}</span>}
              </div>
            )
          })}

          {/* DMs */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 8px 4px' }}>Direct Messages</div>
          {canDM.map(s => {
            const threadId = `dm_${s.id}`
            const count = unreadCount(threadId)
            return (
              <div
                key={s.id}
                onClick={() => setSelected(threadId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                  background: selected === threadId ? 'var(--accent-subtle)' : 'transparent',
                  color: selected === threadId ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 13, marginBottom: 2
                }}
              >
                <div className="avatar avatar-sm" style={{ background: avatarColor(s.name), fontSize: 10 }}>
                  {s.photo ? <img src={s.photo} alt="" /> : initials(s.name)}
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                {count > 0 && <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99 }}>{count}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          {selected.startsWith('dm_') ? (
            <>
              <div className="avatar avatar-sm" style={{ background: avatarColor(selectedLabel || ''), fontSize: 10 }}>{selectedLabel?.[0]}</div>
              <span>{selectedLabel}</span>
            </>
          ) : (
            <span>{channels.find(c => c.id === selected)?.icon} {selectedLabel}</span>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <div>No messages yet. Say hello!</div>
            </div>
          ) : (
            selectedMessages.map(m => {
              const isMe = m.senderId === user?.id
              const sender = staff.find(s => s.id === m.senderId)
              return (
                <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  {!isMe && (
                    <div className="avatar avatar-sm" style={{ background: avatarColor(m.senderName || ''), fontSize: 10, flexShrink: 0 }}>
                      {sender?.photo ? <img src={sender.photo} alt="" /> : initials(m.senderName || '')}
                    </div>
                  )}
                  <div style={{ maxWidth: '70%' }}>
                    {!isMe && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{m.senderName}</div>
                    )}
                    <div style={{
                      background: isMe ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: isMe ? 'white' : 'var(--text-1)',
                      padding: '8px 14px', borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      fontSize: 13, lineHeight: 1.5
                    }}>
                      {m.text}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <input
            className="form-input"
            placeholder={`Message ${selectedLabel}…`}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Send</button>
        </form>
      </div>
    </div>
  )
}
