'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, initials, avatarColor, timeAgo } from '../../lib/utils'
import { AppMessage, Staff, MessageThread } from '../../types'
import { Search, X, Plus } from 'lucide-react'

export default function MessagesPage() {
  const { user, staff, messageThreads, getThreadMessages, getThreadUnreadCount, sendMessage, saveMessages, messages, getOrCreateThread, saveMessageThreads } = useApp()
  const [selectedThreadId, setSelectedThreadId] = useState('all_staff')
  const [text, setText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewDM, setShowNewDM] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter threads by user participation and permissions
  const userThreads = useMemo(() => {
    if (!user) return []

    return messageThreads.filter(thread => {
      // Group channels
      if (thread.type === 'group') {
        if (thread.id === 'admin_team') {
          return ['admin', 'team_lead'].includes(user.role)
        }
        return true // All staff can see "All Staff"
      }

      // Direct messages - user must be a participant
      return thread.participants.includes(user.id)
    }).sort((a, b) => {
      // Sort by most recent message
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return bTime - aTime
    })
  }, [messageThreads, user])

  // Staff search for new DMs (admins, task owners, and team leads can message anyone)
  const canMessageAnyone = user?.role && ['admin', 'team_lead'].includes(user.role)
  const availableStaffForDM = useMemo(() => {
    if (!user) return []

    let staffList = staff.filter(s => s.id !== user.id)

    if (!canMessageAnyone) {
      // Regular staff can only message their lead and admins
      staffList = staffList.filter(s =>
        s.id === user.leadId ||
        ['admin', 'team_lead'].includes(s.role)
      )
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      staffList = staffList.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.department?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query)
      )
    }

    return staffList
  }, [staff, user, searchQuery, canMessageAnyone])

  // Get selected thread
  const selectedThread = userThreads.find(t => t.id === selectedThreadId)
  const selectedMessages = useMemo(() => {
    return getThreadMessages(selectedThreadId)
  }, [selectedThreadId, messages.length, getThreadMessages])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedMessages.length])

  // Mark messages as read when thread is opened
  useEffect(() => {
    if (!user || !selectedThread) return

    const threadMessages = getThreadMessages(selectedThreadId)
    const unreadMessages = threadMessages.filter(m => m.senderId !== user.id && !m.read.includes(user.id))

    if (unreadMessages.length > 0) {
      const updatedMessages = messages.map(m => {
        const shouldMarkRead = unreadMessages.find(um => um.id === m.id)
        if (shouldMarkRead && !m.read.includes(user.id)) {
          return { ...m, read: [...m.read, user.id] }
        }
        return m
      })
      saveMessages(updatedMessages)
    }
  }, [selectedThreadId, user?.id])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user || !selectedThread) return

    const isDm = selectedThread.type === 'direct'
    const recipientId = isDm ? selectedThread.participants.find(p => p !== user.id) : undefined

    sendMessage({
      senderId: user.id,
      senderName: user.name,
      text: text.trim(),
      type: isDm ? 'dm' : 'channel',
      channelId: isDm ? undefined : selectedThreadId,
      threadId: selectedThreadId,
      recipientId,
      read: [user.id],
      createdAt: new Date().toISOString()
    })

    setText('')
  }

  function startNewDM(staffMember: Staff) {
    const thread = getOrCreateThread('direct', [user!.id, staffMember.id].sort())
    setSelectedThreadId(thread.id)
    setShowNewDM(false)
    setSearchQuery('')
  }

  const selectedLabel = selectedThread?.type === 'direct'
    ? staff.find(s => s.id === selectedThread.participants.find(p => p !== user?.id))?.name
    : selectedThread?.name

  const selectedIcon = selectedThread?.type === 'direct'
    ? null
    : selectedThread?.icon

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--topbar-h) - 80px)', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Sidebar */}
      <div style={{
        width: 280, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>💬 Messages</span>
          {canMessageAnyone && (
            <button
              className="btn btn-icon btn-sm btn-primary"
              onClick={() => setShowNewDM(!showNewDM)}
              title="New message"
            >
              {showNewDM ? <X size={14} /> : <Plus size={14} />}
            </button>
          )}
        </div>

        {/* New DM Panel */}
        {showNewDM && (
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                className="form-input"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 12 }}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {availableStaffForDM.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-3)', fontSize: 11 }}>
                  {searchQuery ? 'No staff found' : 'No staff available'}
                </div>
              ) : (
                availableStaffForDM.map(s => (
                  <div
                    key={s.id}
                    onClick={() => startNewDM(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 12, marginBottom: 2, background: 'transparent'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="avatar avatar-sm" style={{ background: avatarColor(s.name), fontSize: 9 }}>
                      {s.photo ? <img src={s.photo} alt="" /> : initials(s.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.department}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Thread List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {/* Channels */}
          {userThreads.filter(t => t.type === 'group').length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' }}>Channels</div>
              {userThreads.filter(t => t.type === 'group').map(thread => {
                const count = getThreadUnreadCount(thread.id)
                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    style={{
                      display: 'flex', gap: 8,
                      padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                      background: selectedThreadId === thread.id ? 'var(--accent-subtle)' : 'transparent',
                      color: selectedThreadId === thread.id ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 13, marginBottom: 2, flexDirection: 'column', alignItems: 'stretch'
                    }}
                    onMouseEnter={e => { if (selectedThreadId !== thread.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (selectedThreadId !== thread.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{thread.icon}</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>#{thread.name}</span>
                      {count > 0 && <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>{count}</span>}
                    </div>
                    {thread.lastMessage && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 28 }}>
                        {thread.lastMessage}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {/* DMs */}
          {userThreads.filter(t => t.type === 'direct').length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 8px 4px' }}>Direct Messages</div>
              {userThreads.filter(t => t.type === 'direct').map(thread => {
                const otherId = thread.participants.find(p => p !== user?.id)
                const otherStaff = staff.find(s => s.id === otherId)
                const count = getThreadUnreadCount(thread.id)

                if (!otherStaff) return null

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    style={{
                      display: 'flex', gap: 8,
                      padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                      background: selectedThreadId === thread.id ? 'var(--accent-subtle)' : 'transparent',
                      color: selectedThreadId === thread.id ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 13, marginBottom: 2, flexDirection: 'column', alignItems: 'stretch'
                    }}
                    onMouseEnter={e => { if (selectedThreadId !== thread.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (selectedThreadId !== thread.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar avatar-sm" style={{ background: avatarColor(otherStaff.name), fontSize: 10, flexShrink: 0 }}>
                        {otherStaff.photo ? <img src={otherStaff.photo} alt="" /> : initials(otherStaff.name)}
                      </div>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{otherStaff.name}</span>
                      {count > 0 && <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>{count}</span>}
                    </div>
                    {thread.lastMessage && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 36 }}>
                        {thread.lastMessage}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedThread?.type === 'direct' ? (
            <>
              <div className="avatar avatar-sm" style={{ background: avatarColor(selectedLabel || ''), fontSize: 10 }}>
                {staff.find(s => s.name === selectedLabel)?.photo ? (
                  <img src={staff.find(s => s.name === selectedLabel)?.photo || ''} alt="" />
                ) : (
                  selectedLabel?.[0]
                )}
              </div>
              <span>{selectedLabel}</span>
            </>
          ) : (
            <span>{selectedIcon} {selectedLabel}</span>
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
