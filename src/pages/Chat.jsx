import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  sendChatMessage,
  getChatThread,
  markMessagesAsRead
} from '../services/chatApi'
import { sendPushNotification } from '../services/api'
import { PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { useTranslation } from 'react-i18next'

const REFRESH_INTERVAL_MS = 10000
const RETRY_LIMIT_MS = 120000

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
  // Hide thread list by default when opened from client view (selectedUserId provided)
  const [showThreadList, setShowThreadList] = useState(!selectedUserId)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const pollingTimeoutRef = useRef(null)
  const pollingStartRef = useRef(null)
  const lastThreadSignatureRef = useRef(null)

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

  // Automatically select thread if selectedUserId is provided
  useEffect(() => {
    if (selectedUserId) {
      setSelectedThreadUserId(selectedUserId)
      setShowThreadList(false) // Hide thread list when opened from client view
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
  const buildThreads = (messages) => {
    const threads = {}
    messages.forEach((msg) => {
      const otherUserId = msg.senderId === senderId ? msg.recipientId : msg.senderId
      if (!threads[otherUserId]) {
        threads[otherUserId] = []
      }
      threads[otherUserId].push(msg)
    })
    Object.keys(threads).forEach((userId) => {
      threads[userId].sort((a, b) => new Date(a.dateTimeCreated) - new Date(b.dateTimeCreated))
    })
    return threads
  }

  const getThreadSignature = (threadMessages) => {
    if (!threadMessages?.length) return 'empty'
    const lastMessage = threadMessages[threadMessages.length - 1]
    return `${threadMessages.length}-${lastMessage?.id || lastMessage?.dateTimeCreated || 'unknown'}`
  }

  const threads = buildThreads(allMessages)
  const threadUserIds = Object.keys(threads)
  const currentThreadMessages = selectedThreadUserId ? threads[selectedThreadUserId] || [] : []

  useEffect(() => {
    if (!selectedThreadUserId) return
    lastThreadSignatureRef.current = getThreadSignature(currentThreadMessages)
  }, [selectedThreadUserId, currentThreadMessages])

  useEffect(() => {
    if (!senderId || !selectedThreadUserId) return

    let stopped = false
    pollingStartRef.current = Date.now()

    const stopPolling = () => {
      stopped = true
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }

    const runPoll = async () => {
      if (stopped) return

      const elapsedMs = Date.now() - pollingStartRef.current
      if (elapsedMs >= RETRY_LIMIT_MS) {
        stopPolling()
        return
      }

      try {
        const response = await getChatThread(senderId)
        if (response.ok) {
          const incomingMessages = response.data || []
          const incomingThreads = buildThreads(incomingMessages)
          const incomingThreadMessages = incomingThreads[selectedThreadUserId] || []
          const incomingSignature = getThreadSignature(incomingThreadMessages)
          const hasNewMessages = incomingSignature !== lastThreadSignatureRef.current

          setAllMessages(incomingMessages)

          if (hasNewMessages) {
            lastThreadSignatureRef.current = incomingSignature
            pollingStartRef.current = Date.now()
            pollingTimeoutRef.current = setTimeout(runPoll, REFRESH_INTERVAL_MS)
            return
          }
        }
      } catch (err) {
        console.error('Error refreshing messages:', err)
      }

      pollingTimeoutRef.current = setTimeout(runPoll, REFRESH_INTERVAL_MS)
    }

    pollingTimeoutRef.current = setTimeout(runPoll, REFRESH_INTERVAL_MS)

    return stopPolling
  }, [senderId, selectedThreadUserId])
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
      setError(t('common.Please select a user to message'))
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

        // Send push notification to recipient if token available
        const recipientDetails = currentThreadMessages.length > 0
          ? (currentThreadMessages[0].senderId === senderId
            ? currentThreadMessages[0].recipientDetails
            : currentThreadMessages[0].senderDetails)
          : null

        if (recipientDetails?.pushNotificationToken) {
          sendPushNotification(
            recipientDetails.pushNotificationToken,
            t('common.New message received'),
            ''
          ).catch((pushErr) => {
            console.error('Error sending push notification:', pushErr)
          })
        }
      } else {
        setError(t('common.Failed to send message'))
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

  // Determine if we're in single-client mode (opened from client view)
  const isSingleClientMode = !!selectedUserId

  return (
    <div className="flex h-full bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Threads List Sidebar - Hidden in single-client mode */}
      {!isSingleClientMode && (
      <div className={`${showThreadList ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r border-white/20 backdrop-blur-xl bg-white/40 flex-col`}>
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-white/20 shadow-sm bg-white/60 backdrop-blur-lg">
          <h2 className="text-lg font-bold text-gray-900">{t('common.Chat')}</h2>
          <p className="text-xs text-gray-500 mt-1">{threadUserIds.length} {threadUserIds.length === 1 ? 'conversation' : 'conversations'}</p>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm">{t('common.Loading messages')}</p>
            </div>
          ) : threadUserIds.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <p className="text-gray-500 text-sm text-center">{t('common.No conversations yet')}</p>
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
            {isLoadingMessages ? t('common.Loading') + '...' : t('common.Refresh')}
          </button>
        </div>
      </div>
      )}

      {/* Messages Area */}
      <div className={`${!showThreadList || isSingleClientMode ? 'flex' : 'hidden'} md:flex flex-1 flex-col relative overflow-hidden`}>
        {selectedThreadUserId ? (
          <>
            {/* Header */}
            <div className="bg-white/95 backdrop-blur-lg border-b border-gray-200/50 px-4 md:px-6 py-4 shadow-sm flex items-center justify-between flex-shrink-0 z-10">
              {currentThreadMessages.length > 0 && (
                (() => {
                  const firstMsg = currentThreadMessages[0]
                  const otherUserDetails = firstMsg.senderId === senderId ? firstMsg.recipientDetails : firstMsg.senderDetails
                  return (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {!isSingleClientMode && (
                        <button
                          onClick={() => setShowThreadList(true)}
                          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                          {otherUserDetails?.displayName || selectedThreadUserId}
                        </h1>
                        {otherUserDetails?.email && (
                          <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">{otherUserDetails.email}</p>
                        )}
                      </div>
                    </div>
                  )
                })()
              )}
              {!isSingleClientMode && (
                <button
                  onClick={loadAllChatThreads}
                  disabled={isLoadingMessages}
                  className="px-3 py-2 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm border border-gray-200 flex-shrink-0"
                  title={t('common.Refresh')}
                >
                  {isLoadingMessages ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                  ) : (
                    '↻'
                  )}
                </button>
              )}
            </div>

            {/* Messages Container */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0"
              style={{ paddingBottom: '100px' }}
            >
              {currentThreadMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{t('common.No messages yet')}</p>
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
                      <div className="space-y-1 max-w-xs md:max-w-md lg:max-w-lg">
                        {!isSentByCurrentUser && (
                          <p className="text-xs text-gray-600 font-medium px-2">{senderName}</p>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-2xl shadow-sm backdrop-blur-sm ${
                            isSentByCurrentUser
                              ? 'bg-blue-500 text-white rounded-br-none'
                              : 'bg-white/90 text-gray-900 rounded-bl-none border border-gray-200/50'
                          }`}
                        >
                          <p className="break-words text-sm md:text-base leading-relaxed">{msg.message}</p>
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

            {/* Input Area - Fixed at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 shadow-lg z-10">
              <form
                onSubmit={handleSendMessage}
                className="px-4 md:px-6 py-3 md:py-4"
              >
                <div className="flex gap-2 md:gap-3 items-end">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={t('common.Type your message') + '...'}
                    className="flex-1 px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm md:text-base shadow-sm"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage(e)
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg min-w-[60px] md:min-w-[80px]"
                  >
                    <PaperAirplaneIcon className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="hidden md:inline text-sm font-medium">
                      {loading ? t('common.Sending') + '...' : t('common.Send')}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <p className="text-gray-500 text-base md:text-lg">{t('common.Select a conversation to start messaging')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatPage