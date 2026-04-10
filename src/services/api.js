/* eslint-disable no-undef */
import { auth } from '../config/firebase'

import {
  API_BO_BASE_URL,
  API_FE_BASE_URL,
  API_BASE_FOODSYNC_URL
} from './const'

// API service for fetching program subscribers

const API_AUTH = 'c29aWGZHd0o6ZT54LXVUZi1GOGohaVFyVHFy'
const nutritionistRecipesByCountryInFlight = new Map()

// Helper function to get headers with Firebase auth token
const getHeaders = async (includeAuthToken = true) => {
  const headers = {
    Authorization: `Basic ${API_AUTH}`,
    'Content-Type': 'application/json'
  }

  // Add Firebase auth token if user is logged in
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      if (includeAuthToken) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch (error) {
      console.error('Error getting Firebase token:', error)
    }
  }

  return headers
}

export const fetchProgramSubscribers = async () => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getProgramSubscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching program subscribers:', error)
    throw error
  }
}

export const fetchUserDailyNutrition = async (userId, dateApplied) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUserDailyNutrition`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: userId,
        dateApplied: dateApplied
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching user daily nutrition:', error)
    throw error
  }
}

export const formatSubscriptionStatus = subscriber => {
  // Website-only users who never opened the app
  if (subscriber.noMobileOnboarding) {
    const payment = subscriber.paymentDetails || {}
    const isPaid = payment.paymentSuccess === true || payment.status?.toLowerCase() === 'completed'
    return {
      status: 'inactive',
      plan: isPaid ? 'Paid - Not Onboarded' : 'No Plan',
      expiresAt: 'N/A'
    }
  }

  // Check subscription whitelist details first
  if (subscriber.subscriptionWhitelistDetails?.isPro === 'true') {
    const activeUntil = subscriber.subscriptionWhitelistDetails?.activeUntil
    const todayStr = new Date().toISOString().slice(0, 10)
    const isExpired = activeUntil && activeUntil < todayStr
    if (!isExpired) {
      return {
        status: 'active',
        plan: 'Program Plan',
        expiresAt: activeUntil || 'N/A'
      }
    }
  }

  // Check subscription details
  if (subscriber.subscriptionDetails?.Pro?.isActive) {
    return {
      status: 'active',
      plan: 'Pro Plan',
      expiresAt: subscriber.subscriptionDetails.Pro.expirationDate || 'N/A'
    }
  }

  return {
    status: 'inactive',
    plan: 'No Plan',
    expiresAt: 'N/A'
  }
}

export const formatUserData = subscriber => {
  const userData = subscriber.userData || {}
  const loginDetails = subscriber.loginDetails || {}

  // Try to get name from multiple sources
  let name = 'Unknown'
  if (userData.name) {
    name = userData.name
  } else if (subscriber.firstName && subscriber.lastName) {
    name = `${subscriber.firstName} ${subscriber.lastName}`.trim()
  } else if (loginDetails.displayName) {
    name = loginDetails.displayName
  } else if (subscriber.firstName) {
    name = subscriber.firstName
  } else if (subscriber.lastName) {
    name = subscriber.lastName
  }

  return {
    name: name,
    email:
      loginDetails?.providerData?.[0]?.email ||
      loginDetails?.email ||
      subscriber.email ||
      'N/A',
    phone: subscriber.phoneNumber || 'N/A',
    country: subscriber.country || 'N/A',
    gender: userData.selectedGender || 'N/A',
    age: userData.selectedBirthDate
      ? new Date().getFullYear() -
        new Date(userData.selectedBirthDate).getFullYear()
      : 'N/A',
    height: userData.selectedHeight ? `${userData.selectedHeight} cm` : 'N/A',
    weight: userData.selectedWeight ? `${userData.selectedWeight} kg` : 'N/A',
    goal: userData.selectedGoalType || 'N/A',
    activity: userData.selectedActivityType || 'N/A'
  }
}

export const formatPaymentData = subscriber => {
  const payment = subscriber.paymentDetails || {}
  return {
    status: payment.status || 'N/A',
    amount: payment.paymentSuccess ? 'Paid' : 'Not Paid',
    date: payment.paymentDate || 'N/A',
    country: payment.detectedCountry || 'N/A'
  }
}

export const sendPushNotification = async (
  pushNotificationToken,
  notificationTitle,
  notificationBody
) => {
  try {
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/notifications/sendPushNotification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pushNotificationToken,
          notificationTitle,
          notificationBody
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending push notification:', error)
    throw error
  }
}

export const searchFoodItems = async ({
  searchText,
  userId,
  onlyRecipes = false,
  countryCode = null
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/elasticSearch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        searchTerm: searchText,
        itemType: 'FOOD',
        onlyRecipes,
        countryCode: countryCode || 'RO'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    console.error('Error searching food items:', error)
    throw error
  }
}

export const getItemsByIds = async ({ ids }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getItemsByIds`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting items by ids:', error)
    throw error
  }
}

export const getUnapprovedItems = async () => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUnapprovedItems`, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return (
      data?.data || { foodItems: { items: [] }, exerciseItems: { items: [] } }
    )
  } catch (error) {
    console.error('Error getting unapproved items:', error)
    throw error
  }
}

export const getRecipesByCountryCode = async ({ countryCode }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BO_BASE_URL}/getRecipesByCountryCode?countryCode=${encodeURIComponent(countryCode)}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data?.data || []
  } catch (error) {
    console.error('Error getting recipes by country code:', error)
    throw error
  }
}

export const getNutritionistRecipesByCountryCode = async ({ countryCode }) => {
  const cacheKey = String(countryCode || 'RO').toUpperCase()
  if (nutritionistRecipesByCountryInFlight.has(cacheKey)) {
    return nutritionistRecipesByCountryInFlight.get(cacheKey)
  }

  const requestPromise = (async () => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-recipes/by-country?countryCode=${encodeURIComponent(cacheKey)}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data?.data || []
  } catch (error) {
    console.error('Error getting nutritionist recipes by country code:', error)
    throw error
  } finally {
    nutritionistRecipesByCountryInFlight.delete(cacheKey)
  }
  })()

  nutritionistRecipesByCountryInFlight.set(cacheKey, requestPromise)
  return requestPromise
}

export const addNutritionistRecipe = async ({ data }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-recipes/add`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ data })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error adding nutritionist recipe:', error)
    throw error
  }
}

export const updateNutritionistRecipe = async ({ itemId, data }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-recipes/update`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ itemId, data })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating nutritionist recipe:', error)
    throw error
  }
}

export const deleteNutritionistRecipe = async ({ itemId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-recipes/delete`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error deleting nutritionist recipe:', error)
    throw error
  }
}

export const getNutritionistFoodItemsByCountryCode = async ({ countryCode }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-food-items/by-country?countryCode=${encodeURIComponent(countryCode)}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data?.data || []
  } catch (error) {
    console.error('Error getting nutritionist food items by country code:', error)
    throw error
  }
}

export const addNutritionistFoodItem = async ({ data }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-food-items/add`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ data })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error adding nutritionist food item:', error)
    throw error
  }
}

export const updateNutritionistFoodItem = async ({ itemId, data }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-food-items/update`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ itemId, data })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating nutritionist food item:', error)
    throw error
  }
}

export const deleteNutritionistFoodItem = async ({ itemId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/nutritionist-food-items/delete`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error deleting nutritionist food item:', error)
    throw error
  }
}

export const setItemVerifiedStatus = async ({ itemId, verified, itemType }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/setItemVerifiedStatus`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemId,
        verified,
        itemType
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error setting item verified status:', error)
    throw error
  }
}

export const setItemsVerifiedStatus = async ({ items, verified }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/setItemsVerifiedStatus`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items,
        verified
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error setting items verified status:', error)
    throw error
  }
}

export const deleteItems = async ({ items, userId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/deleteItems`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items,
        userId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting items:', error)
    throw error
  }
}

export const getAllMenuTemplates = async (createdByUserId = null) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getAllMenuTemplates`, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        createdByUserId
          ? {
              createdByUserId
            }
          : {}
      )
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting all menu templates:', error)
    throw error
  }
}

export const addMenuTemplate = async ({
  breakfastPlan,
  lunchPlan,
  dinnerPlan,
  snackPlan,
  name,
  isAssignableByUser,
  createdByUserId
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/addMenuTemplate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        breakfastPlan,
        lunchPlan,
        dinnerPlan,
        snackPlan,
        name,
        isAssignableByUser,
        createdByUserId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding menu template:', error)
    throw error
  }
}

export const updateMenuTemplate = async ({
  menuTemplateId,
  breakfastPlan,
  lunchPlan,
  dinnerPlan,
  snackPlan,
  name,
  isAssignableByUser
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/updateMenuTemplate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        menuTemplateId,
        breakfastPlan,
        lunchPlan,
        dinnerPlan,
        snackPlan,
        name,
        isAssignableByUser
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating menu template:', error)
    throw error
  }
}

export const deleteMenuTemplateById = async ({ menuTemplateId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/deleteMenuTemplateById`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        menuTemplateId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting menu template by id:', error)
    throw error
  }
}

export const assignMenuTemplateToUser = async ({
  userId,
  menuTemplateId,
  dateApplied,
  replaceExisting = true
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BO_BASE_URL}/assignMenuTemplateToUser`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          menuTemplateId,
          dateApplied,
          replaceExisting
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error assigning menu template to user:', error)
    throw error
  }
}

export const removeMenuFromUser = async ({
  userId,
  dateApplied,
  menuTemplateId
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/removeMenuFromUser`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        dateApplied,
        menuTemplateId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error removing menu from user:', error)
    throw error
  }
}

export const copyMenuTemplateToCountry = async ({
  menuTemplate,
  countryCode,
  userId,
  createdByUserId = null,
  menuName = null
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BASE_FOODSYNC_URL}/foodsync/copyMenuTemplateBO`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          menuTemplate,
          countryCode,
          userId,
          createdByUserId,
          menuName
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error copying menu template to country:', error)
    throw error
  }
}

export const getUserMenus = async ({ userId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUserMenus`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting user menus:', error)
    throw error
  }
}

export const getUserByUserId = async ({ userId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUserByUserId`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting user by user id:', error)
    throw error
  }
}

export const getUsers = async () => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUsers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting users:', error)
    throw error
  }
}

export const getUserRewardsSummary = async () => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUserRewardsSummary`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting user rewards summary:', error)
    throw error
  }
}

export const getUserPurchaseRequests = async ({ userId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getUserPurchaseRequests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting user purchase requests:', error)
    throw error
  }
}

export const updateUserPurchaseStatus = async ({ purchaseId, status }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/updateUserPurchaseStatus`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ purchaseId, status })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating user purchase status:', error)
    throw error
  }
}

export const getUserMessages = async ({ userId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BO_BASE_URL}/messages/getUserMessages?userId=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    console.error('Error getting user messages:', error)
    throw error
  }
}

export const sendMessageToUser = async ({ userId, message }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/messages/sendMessage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, message })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending user message:', error)
    throw error
  }
}

export const sendPushNotificationToUser = async ({
  pushNotificationToken,
  notificationTitle,
  notificationBody
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(
      `${API_BO_BASE_URL}/notifications/sendPushNotification`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pushNotificationToken,
          notificationTitle,
          notificationBody
        })
      }
    )
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending push notification to user:', error)
    throw error
  }
}

export const updateMessage = async ({ messageId, message }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/messages/updateMessage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messageId, message })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating message:', error)
    throw error
  }
}

export const deleteMessage = async ({ messageId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/messages/deleteMessage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messageId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting message:', error)
    throw error
  }
}

export async function saveImageToImgb(image) {
  const formData = new FormData()
  if (typeof image === 'string') {
    if (image.includes('data:image')) {
      // Convert data URL to blob
      const response = await fetch(image)
      const blob = await response.blob()
      formData.append('image', blob, 'image.jpg')
    } else {
      formData.append('image', image)
    }
  } else if (image instanceof File) {
    formData.append('image', image)
  } else if (image?.uri) {
    // For React Native style image objects
    const response = await fetch(image.uri)
    const blob = await response.blob()
    const fileName = `image.${image.uri.split('.').pop() || 'jpg'}`
    formData.append('image', blob, fileName)
  } else {
    formData.append('image', image)
  }

  try {
    // Get Firebase token for auth
    let authHeader = `Basic ${API_AUTH}`
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken()
        authHeader = `Bearer ${token}`
      } catch (error) {
        console.error('Error getting Firebase token:', error)
      }
    }

    const response = await fetch(`${API_BO_BASE_URL}/images/upload`, {
      method: 'POST',
      headers: {
        Authorization: authHeader
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result?.data?.id) {
      return result.data
    } else {
      return null
    }
  } catch (error) {
    console.error('Error saving image to imgbb:', error)
    return null
  }
}

export const addItem = async itemData => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/addItem`, {
      method: 'POST',
      headers,
      body: JSON.stringify(itemData)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding item:', error)
    throw error
  }
}

export const updateItem = async ({ userId, itemId, data, itemType }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/updateItem`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ userId, itemId, data, itemType })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData = await response.json()
    return responseData
  } catch (error) {
    console.error('Error updating item:', error)
    throw error
  }
}

export const deleteItem = async ({ itemId, itemType, userId }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/deleteItem`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ itemId, itemType, userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting item:', error)
    throw error
  }
}

export const addPhotoToItem = async ({
  itemId,
  itemType,
  userId,
  photoUrl
}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/addPhotoToItem`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ itemId, itemType, userId, photoUrl })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding photo to item:', error)
    throw error
  }
}

export const getUserById = async userId => {
  try {
    const headers = await getHeaders(true)
    const response = await fetch(`${API_FE_BASE_URL}/getUserById`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching logged in user:', error)
    throw error
  }
}

export const auth0Login = async ({ user, userId }) => {
  try {
    const response = await fetch(`${API_FE_BASE_URL}/users/auth0-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user, userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error completing auth0 login:', error)
    throw error
  }
}

// ─── Bug Hunting ─────────────────────────────────────────────────────────────

export const getAllBugs = async ({ status, search, limit = 200, offset = 0 } = {}) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/getAllBugs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status, search, limit, offset })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.data || { bugs: [], total: 0 }
  } catch (error) {
    console.error('Error fetching bugs:', error)
    throw error
  }
}

export const updateBugStatus = async ({ bugId, bugStatus, bugType, potentialPaymentValue, potentialPaymentCurrency }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/updateBugStatus`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ bugId, bugStatus, bugType, potentialPaymentValue, potentialPaymentCurrency })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error updating bug status:', error)
    throw error
  }
}

export const setUserSubscriptionWhitelistDetails = async ({ userId, id, subscriptionWhitelistDetails }) => {
  try {
    const headers = await getHeaders()
    const response = await fetch(`${API_BO_BASE_URL}/setUserSubscriptionWhitelistDetails`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, id, subscriptionWhitelistDetails })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error setting user subscription whitelist details:', error)
    throw error
  }
}
