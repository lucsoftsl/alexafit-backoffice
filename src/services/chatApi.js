/* eslint-disable no-undef */
import { auth } from '../config/firebase'

import { API_BASE_FOODSYNC_URL } from './const'

const getHeaders = async () => {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      headers['Authorization'] = `Bearer ${token}`
    } catch (error) {
      console.error('Error getting Firebase token:', error)
    }
  }

  return headers
}

export const sendChatMessage = async (senderId, recipientId, message) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/foodsync/chat/send`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderId,
          recipientId,
          message,
          senderType: 'backoffice'
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending chat message:', error)
    throw error
  }
}

export const getChatThread = async userId => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/foodsync/chat/thread/${userId}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching chat thread:', error)
    throw error
  }
}

export const getUnreadMessagesCount = async userId => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/foodsync/chat/unread/${userId}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching unread count:', error)
    throw error
  }
}

export const markMessagesAsRead = async (userId, senderId) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/foodsync/chat/markAsRead`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          senderId
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error marking messages as read:', error)
    throw error
  }
}
