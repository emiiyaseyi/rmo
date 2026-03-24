'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { initials, avatarColor, timeAgo } from '../../lib/utils'
import { MessageCircle, X, Send, Minus } from 'lucide-react'

export default function FloatingChatWidget() {
  const { user, unreadMessageCount, messageThreads, getThreadMessages, sendMessage, saveMessages, messages, staff } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [text, setText] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState('admin_team')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)

  // Default to Admin Team channel
  const adminTeamThread = messageThreads.find(t => t.id === 'admin_team')
  const currentThread = messageThreads.find(t => t.id === selectedThreadId) || adminTeamThread

  const threadMessages = currentThread ? getThreadMessages(currentThread.id) : []

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [threadMessages.length, isOpen])

  // Reopen widget when new unread messages arrive if dismissed
  useEffect(() => {
    if (isDismissed && unreadMessageCount > 0) {
      setIsDismissed(false)
    }
  }, [unreadMessageCount, isDismissed])

  // Mark messages as read when widget is opened
  useEffect(() => {
    if (isOpen && user && currentThread) {
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
    }
  }, [isOpen, currentThread?.id])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user || !currentThread) return

    sendMessage({
      senderId: user.id,
      senderName: user.name,
      text: text.trim(),
      type: 'channel',
      channelId: currentThread.id,
      threadId: currentThread.id,
      read: [user.id],
      createdAt: new Date().toISOString()
    })

    setText('')
  }

  // Don't render if dismissed
  if (isDismissed) return null

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10
      }}
    >
      {isOpen ? (
        /* Expanded Chat Window */
        <div
          style={{
            width: 360,
            maxHeight: 500,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--accent)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageCircle size={18} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {currentThread?.icon} {currentThread?.name || 'Messages'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Minus size={16} />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsDismissed(true)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--bg-surface)'
            }}
          >
            {threadMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 40, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div>No messages yet</div>
              </div>
            ) : (
              threadMessages.slice(-20).map(m => {
                const isMe = m.senderId === user?.id
                const sender = staff.find(s => s.id === m.senderId)
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end'
                    }}
                  >
                    {!isMe && (
                      <div
                        className="avatar avatar-sm"
                        style={{
                          background: avatarColor(m.senderName || ''),
                          fontSize: 9,
                          flexShrink: 0,
                          width: 24,
                          height: 24
                        }}
                      >
                        {sender?.photo ? <img src={sender.photo} alt="" /> : initials(m.senderName || '')}
                      </div>
                    )}
                    <div style={{ maxWidth: '75%' }}>
                      {!isMe && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>
                          {m.senderName}
                        </div>
                      )}
                      <div
                        style={{
                          background: isMe ? 'var(--accent)' : 'var(--bg-elevated)',
                          color: isMe ? 'white' : 'var(--text-1)',
                          padding: '6px 10px',
                          borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                          fontSize: 12,
                          lineHeight: 1.4
                        }}
                      >
                        {m.text}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: 'var(--text-3)',
                          marginTop: 2,
                          textAlign: isMe ? 'right' : 'left'
                        }}
                      >
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
          <form
            onSubmit={handleSend}
            style={{
              padding: 12,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              background: 'var(--bg-card)',
              flexShrink: 0
            }}
          >
            <input
              className="form-input"
              placeholder="Type a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={!text.trim()}
              style={{ padding: '6px 12px' }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      ) : (
        /* Collapsed FAB Button */
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'
          }}
        >
          <MessageCircle size={24} />
          {unreadMessageCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: 'var(--danger)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                minWidth: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '2px solid white'
              }}
            >
              {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
