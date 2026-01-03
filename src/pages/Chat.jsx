import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  sendChatMessage,
  getChatThread,
  markMessagesAsRead,
} from '../services/chatApi'
import { PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'

function ChatPage({ selectedUserId = null }) {
  const { t } = useTranslation()
  const { currentUser, userData } = useAuth()
  const [allMessages, setAllMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [senderId] = useState(currentUser?.uid || '')
  const [selectedThreadUserId, setSelectedThreadUserId] = useState(selectedUserId || '')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [showThreadList, setShowThreadList] = useState(true)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [allMessages, selectedThreadUserId])

  useEffect(() => {
    if (senderId) {
      loadAllChatThreads()
    }
  }, [senderId])

  // Automatically select first thread if selectedUserId is provided
  useEffect(() => {
    if (selectedUserId) {
      setSelectedThreadUserId(selectedUserId)
    }
  }, [selectedUserId])

  const loadAllChatThreads = async () => {
    try {
      setIsLoadingMessages(true)
      setError(null)
      const response = await getChatThread(senderId)
      if (response.ok) {
        setAllMessages(response.data || [])
      } else {
        setError('Failed to load messages')
      }
    } catch (err) {
      console.error('Error loading chat threads:', err)
      setError(err.message)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Group messages by recipientId or senderId (whoever is not the current user)
  const groupedThreads = () => {
    const threads = {}
    allMessages.forEach((msg) => {
      const otherUserId = msg.senderId === senderId ? msg.recipientId : msg.senderId
      if (!threads[otherUserId]) {
        threads[otherUserId] = []
      }
      threads[otherUserId].push(msg)
    })
    // Sort each thread by date
    Object.keys(threads).forEach((userId) => {
      threads[userId].sort((a, b) => new Date(a.dateTimeCreated) - new Date(b.dateTimeCreated))
    })
    return threads
  }

  const threads = groupedThreads()
  const threadUserIds = Object.keys(threads)
  const currentThreadMessages = selectedThreadUserId ? threads[selectedThreadUserId] || [] : []
  // Mark messages as read when thread is selected
  useEffect(() => {
    if (selectedThreadUserId && currentThreadMessages.length > 0) {
      const unreadMessages = currentThreadMessages.filter(msg => !msg.isRead && msg.recipientId === senderId)

      if (unreadMessages.length > 0) {
        markMessagesAsRead(selectedThreadUserId, senderId).catch(err => {
          console.error('Error marking messages as read:', err)
        })

        // Update local state to reflect read status
        setAllMessages(prevMessages =>
          prevMessages.map(msg =>
            unreadMessages.some(unreadMsg => unreadMsg.id === msg.id) ? { ...msg, isRead: true } : msg
          )
        )
      }
    }
  }, [selectedThreadUserId, senderId, currentThreadMessages])

  const handleSendMessage = async (e) => {
    e.preventDefault()

    if (!inputMessage.trim()) {
      return
    }

    if (!selectedThreadUserId) {
      setError('Please select a user to message')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await sendChatMessage(senderId, selectedThreadUserId, inputMessage)

      if (response.ok) {
        // Add message to local state with user details
        const newMessage = {
          id: response.data.id,
          senderId,
          recipientId: selectedThreadUserId,
          message: inputMessage,
          senderType: 'backoffice',
          dateTimeCreated: new Date().toISOString(),
          isRead: false,
          senderDetails: userData ? {
            displayName: userData.displayName || currentUser?.displayName || '',
            email: userData.email || currentUser?.email || ''
          } : null
        }
        
        setAllMessages([...allMessages, newMessage])
        setInputMessage('')
      } else {
        setError('Failed to send message')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatMessageDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="flex h-full bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Threads List Sidebar */}
      <div className={`${showThreadList ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r border-white/20 backdrop-blur-xl bg-white/40 flex-col`}>
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-white/20 shadow-sm bg-white/60 backdrop-blur-lg">
          <h2 className="text-lg font-bold text-gray-900">{t('Chat')}</h2>
          <p className="text-xs text-gray-500 mt-1">{threadUserIds.length} {threadUserIds.length === 1 ? 'conversation' : 'conversations'}</p>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm">{t('Loading messages')}</p>
            </div>
          ) : threadUserIds.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <p className="text-gray-500 text-sm text-center">{t('No conversations yet')}</p>
            </div>
          ) : (
            threadUserIds.map((userId) => {
              const threadMsgs = threads[userId]
              const lastMessage = threadMsgs[threadMsgs.length - 1]
              const isSelected = userId === selectedThreadUserId
              const unreadCount = threadMsgs.filter(msg => !msg.isRead && msg.recipientId === senderId).length
              
              // Get display name from senderDetails or recipientDetails
              let displayName = userId
              if (lastMessage.senderDetails?.displayName) {
                displayName = lastMessage.senderDetails.displayName
              } else if (lastMessage.recipientDetails?.displayName) {
                displayName = lastMessage.recipientDetails.displayName
              }

              return (
                <button
                  key={userId}
                  onClick={() => {
                    setSelectedThreadUserId(userId)
                    setShowThreadList(false)
                  }}
                  className={`w-full px-4 py-3 border-b border-white/20 text-left hover:bg-white/50 transition-all duration-200 ${
                    isSelected ? 'bg-white/70 border-l-4 border-l-blue-500 shadow-sm' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 truncate">{displayName}</p>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-blue-500 text-white rounded-full px-2 py-0.5 shadow-sm">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {lastMessage.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatMessageDate(lastMessage.dateTimeCreated)}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Refresh Button */}
        <div className="px-4 py-3 border-t border-white/20 bg-white/30 backdrop-blur-lg hidden">
          <button
            onClick={loadAllChatThreads}
            disabled={isLoadingMessages}
            className="w-full px-3 py-2 bg-white/60 hover:bg-white/80 disabled:bg-white/40 text-gray-700 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm backdrop-blur-sm"
          >
            {isLoadingMessages ? t('Loading') + '...' : t('Refresh')}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className={`${!showThreadList ? 'flex' : 'hidden'} md:flex flex-1 flex-col relative overflow-hidden`}>
        {selectedThreadUserId ? (
          <>
            {/* Header */}
            <div className="bg-white/60 backdrop-blur-lg border-b border-white/20 px-4 md:px-6 py-4 shadow-sm flex items-center justify-between flex-shrink-0">
              {currentThreadMessages.length > 0 && (
                (() => {
                  const firstMsg = currentThreadMessages[0]
                  const otherUserDetails = firstMsg.senderId === senderId ? firstMsg.recipientDetails : firstMsg.senderDetails
                  return (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowThreadList(true)}
                        className="md:hidden p-2 hover:bg-white/50 rounded-lg transition-colors"
                      >
                        <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
                      </button>
                      <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                          {otherUserDetails?.displayName || selectedThreadUserId}
                        </h1>
                        {otherUserDetails?.email && (
                          <p className="text-xs md:text-sm text-gray-500 mt-1">{otherUserDetails.email}</p>
                        )}
                      </div>
                    </div>
                  )
                })()
              )}
              <button
                onClick={loadAllChatThreads}
                disabled={isLoadingMessages}
                className="px-3 py-2 bg-white/60 hover:bg-white/80 disabled:bg-white/40 text-gray-700 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm backdrop-blur-sm"
              >
                {isLoadingMessages ? t('Loading') + '...' : '↻'}
              </button>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0 pb-24">
              {currentThreadMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{t('No messages yet')}</p>
                </div>
              ) : (
                currentThreadMessages.map((msg) => {
                  const isSentByCurrentUser = msg.senderId === senderId
                  const senderName = msg.senderDetails?.displayName || msg.senderId
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSentByCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="space-y-1 max-w-xs md:max-w-md">
                        {!isSentByCurrentUser && (
                          <p className="text-xs text-gray-600 font-medium px-2">{senderName}</p>
                        )}
                        <div
                          className={`px-4 py-2 rounded-lg shadow-sm backdrop-blur-sm ${
                            isSentByCurrentUser
                              ? 'bg-blue-500 text-white rounded-br-none'
                              : 'bg-white/80 text-gray-900 rounded-bl-none border border-white/40'
                          }`}
                        >
                          <p className="break-words text-sm md:text-base">{msg.message}</p>
                        </div>
                        <div
                          className={`text-xs text-gray-500 px-2 ${isSentByCurrentUser ? 'text-right' : 'text-left'}`}
                        >
                          {formatMessageTime(msg.dateTimeCreated)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-700 px-4 py-3 mx-4 md:mx-6 mb-2 rounded-lg shadow-sm">
                {error}
              </div>
            )}

            {/* Input Area */}
            <form
              onSubmit={handleSendMessage}
              className="bg-white/60 backdrop-blur-lg border-t border-white/20 px-4 md:px-6 py-4 shadow-lg"
              style={{ position: 'fixed', bottom: 0, width: 'stretch' }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={t('Type your message') + '...'}
                  className="flex-1 px-4 py-2 md:py-3 border border-gray-300/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80 backdrop-blur-sm text-sm md:text-base"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-sm"
                >
                  <PaperAirplaneIcon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden md:inline">{loading ? t('Sending') + '...' : t('Send')}</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <p className="text-gray-500 text-base md:text-lg">{t('Select a conversation to start messaging')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatPage